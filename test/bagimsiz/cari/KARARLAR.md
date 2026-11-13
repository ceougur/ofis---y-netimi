# Bağımsız CARİ / EVRAK kâhini — kurallar ve kararlar (2.4.4 madde 31a, B1–B2)

Kural seti (06.11.2026): **`2.5.0`** varsayılan (2.4.9 + Ç5: açılış 519, KG-5, S49, tek yükümlülük kuyruğu S50 / S2 / ANINDA, B1 gecikmiş S52 — §13; bakım 2: S68 borç tarafı vade sırası, S67 takvim kalemi, S66 carisiz evrakın karşılıksızı — §14; bakım 3: S69 söz günü / söz geçmiş takvim kalemi — §15; bakım 4 (10.11.2026): S91 vadesiz kayıt kayıt gününde kalem, S92 net görünüm — karşı yönlü kalemler kendi belge tarihinde netleşir, S93 verilen avans gecikmişte — §16; bakım 5–6 (10.11.2026): S95–S98 iki yönlü tek kuyruğun birlikte okunuşu, verilen avans kalemi — §17; S99 taksitli fatura / belge durumu tek kuyruktan,
S101 avansla "Bitti" kart, S102–S105 kalan okumalar — §18); (03.11.2026): **`2.4.9`** (2.4.6 + C1 hareketli cari silinemez — §12); 25.10.2026: **`2.4.6`** (2.4.5 + KS8–KS10 — §9; dil `/3` aynı, iki ek: `iade {geri}`, adımda `catal`); `--kural 2.4.5` 2.4.5 beklentilerini bayt bayt verir,
`--legacy` 2.4.4. Dil: **`destekofis-cari/3`** (24.10.2026, 2.4.5 kuralları — §8; `/1` `/2` senaryoları değişmeden koşar ya da 2.4.5 kararıyla geçersiz diye atlanır — §8 C0) · `/2`: 23.10.2026, B3–B5 · İlk yazıldığı gün: 22.10.2026 · Kâhin: `model.py` (Python 3, yalnız standart kütüphane, `python3 -I`) ·
Koşucu: `kos.mjs` · Rastgele üretici: `uretici.py` · Elle senaryolar: `senaryolar/*.json` · Komut: `node --disable-warning=ExperimentalWarning test/bagimsiz/cari/kos.mjs` (npm betiği `test:kahin-cari`, iş akışına eklenirken açılır: test/ci-kapi-listesi.test.mjs her test:kahin-* betiğinin ci.yml ya da uzun-dogrulama.yml'de koşmasını ister).

## 0. Temiz oda

- **Okunan kaynaklar:** CLAUDE.md "Açık iş" kullanıcı kararları (22.10.2026 madde 5 soruları (a)(b)(c) ve 5a/5b soruları (1)(2)(3);
  KARARLAR (2) UX18; "SORU (22.10.2026, madde 15 UX18)" kararı), `docs/BANKA-MODULU-PLAN.md` (§3.11a çek/senet hesapları, §8.10 bağ
  türleri "Otomatik (En Eski)", §4.3/2 FIFO, Özet K11), `test/bagimsiz/SENARYO-DILI.md` §6–§7 (önceki temiz oda kâhininin fatura açığı
  kuralları), ana oturumun kural dosyası KURALLAR-244.md (B1, B2 ve "Ajan kural metinleri" 5a/5b/5c, 15).
- **Okunmayanlar:** `server/**`, `client/**`, `test/e2e/**`, `docs/DURUM-VE-DEVAM.md`, `docs/2.4.4-IS-LISTESI.md`, `docs/kanit/**`, git
  geçmişi/farkları. `test/*.test.mjs` dosyalarından yalnız İSTEK satırları (uç yolu + gövde) grep ile okundu; beklenen/assert satırları okunmadı.
- **Ajan örneklerinin çıktıları beklenen sayı değildir** (KURALLAR-244 başı): kâhin her sayıyı kendi kuralıyla hesaplar.

## 1. Etiketler ve fark sınıfı

| Etiket | Kaynak | Programla fark |
|---|---|---|
| KULLANICI | CLAUDE.md "Açık iş" ürün sahibi kararı | **BULGU** |
| PLAN | docs/BANKA-MODULU-PLAN.md açık kuralı | **BULGU** |
| AJAN | kodu yazan ajanın raporladığı ayrıntı (KURALLAR-244 "Ajan kural metinleri") | İNCELE |
| YAYGIN | kaynak susuyor; yaygın muhasebe/ERP uygulaması (gerekçesi kuralda) | İNCELE |
| BAŞ MİMAR | /3: `docs/2.4.5-IS-LISTESI.md` "BAŞ MİMAR KARARLARI" (S1, K6.1–K6.4, K1) — kod yazılmadan önce yazılmış karar metni (ders 40) | **BULGU** |
| YORUM | /3: karar metni var ama iki okumaya açık; kâhin harfiyen okumayı uygular, raporda SORU (§8 C11). KS1–KS6 kararından (24.10.2026) sonra KULLANILMIYOR | İNCELE |

Bir denetimin etiketi, o carinin geçmişinde yalnız AJAN/YAYGIN kuralına dayanan bir olay varsa (ör. evrak faturanın açığından büyük, fatura
iptalinde bağ düştü, evrak çöp kutusundan geri yüklendi, bağ değiştirildi, bağsız evrak karşılıksız döndü) o cari için AJAN'a düşer
(model.py `etiketCari`). Böylece BULGU sınıfı yalnız birincil kaynağın tek başına belirlediği sonuçlara verilir.

## 2. Programın uçları (nereden öğrenildi)

| Uç | Kaynak |
|---|---|
| POST /api/workspace/dataset/stage {kind, fileName, sheets:[{name, matrix}]} · POST /dataset/commit {stageId, mode} | test/tablodan-aktar-244.test.mjs çağrı satırları |
| GET /api/workspace/plans/from-table[?accountIn=0&coverDebt=0] → records[{key, caseNo, name, …}], fingerprint | aynı + kara kutu yoklaması (yanıt alanları) |
| POST /api/workspace/plans/from-table {keys, fingerprint, accountIn, coverDebt} → importId, created, accountEntriesMoved/Amount, covered, skipped | aynı + yoklama (seçenekler gövde ve sorgu ile birlikte gönderilir) |
| POST /api/workspace/plans/imports/:id/undo · GET /api/workspace/plans · GET /plans/:id (items[].paid, totals, coversBalance) · POST /plans/:id/entries | aynı + defter/kos.mjs (taksit tahsilatı) |
| POST /api/workspace/accounts {name, type, phone, caseKey, caseTitle, openingBalance, openingSide:"auto", registeredOn} | tablodan-aktar-244 çağrı satırları |
| POST /api/workspace/accounts/:id/entries {kind: in/debt, amount, date, method, invoiceId?, cashForce, similarOk} · GET /accounts/:id (totals.balance, entries) | aynı + ux18-cek-fatura-244 + defter/kos.mjs |
| POST /api/workspace/cases/:key/payments {amount, date, method} · GET /api/workspace/reports/cari-ekstre?from&to (Tablodaki Kişiler) | rapor-tablodaki-kisiler-244 çağrı satırları |
| POST /api/workspace/invoices (satış hizmet faturası, payment rest open / installments / cheques[], status draft, alış expense_purchase, sale_return) · GET /invoices/:id (open, status, lines) · POST /invoices/:id/cancel | ux18-cek-fatura-244 çağrı satırları + defter/kos.mjs |
| POST /api/workspace/cheques {direction:"in", instrument, accountId, amount, issueDate, dueDate, serialNo, bank, invoiceId?} · POST /cheques/:id/actions {action: bounce/collect/endorse, …} · PUT /cheques/:id {invoiceId, updatedAt} · DELETE /cheques/:id · GET /api/admin/trash · POST /api/admin/trash/restore {id:"cheque:<id>"} | ux18-cek-fatura-244 çağrı satırları + SENARYO-DILI sürüm 3 |
| GET /api/workspace/cash (totals.balance) · GET /api/workspace/ledger (trial.accounts) | defter/kos.mjs |

## 3. Kurallar

### B1 — Tablodan Aktar (madde 5a–5c)
- **B1.1** [PLAN] Cari bakiyesi = açılış + borçlar + satış faturaları + yeni borçlu kartlar − tahsilatlar − alınan evrak + karşılıksız evrak.
- **B1.2** [KULLANICI (a), (1)] Kayda bağlı carinin taksit dışı tahsilatları **tarih sırasıyla** (eşit tarihte yazım sırası; ders 31), **bütün**
  olarak karta yazılır, en çok kartın tutarı kadar; tahsilat **bölünmez**; karta yazılan tutar **en eski taksitten** başlayarak taksitlere
  sayılır; **cari bakiyesi ve Kasa değişmez**. [AJAN] sığmayan ilk tahsilatta durulur (sonraki küçük tahsilat da taşınmaz) — bu ayrıntıya
  dayanan denetimler İNCELE.
- **B1.3** Kart tutarı = tablodaki kalan (Excel'de ödenen bilgisi olmayan taksit sütunlarında Σ taksit).
- **B1.4** [KULLANICI (b), (2)] Carinin borcu D = bakiye + taşınacak tahsilatlar ([AJAN] tanım). D ≥ kalan → kart "mevcut borcu taksitlendir",
  yeni borç yazılmaz; 0 < D < kalan → kişi **aktarılmaz** (atlanan); [YAYGIN] D ≤ 0 → yeni borç (borcu olmayan cari; çift borç riski yok,
  2.4.3 davranışı). Seçenek kapalıysa (coverDebt=0) yeni borç.
- **B1.5** [KULLANICI (3)] Faturalı caride 5a/5b uygulanmaz: tahsilat taşınmaz, kart yeni borç yazar; tahsilat faturayı en eskiden kapatır.
- **B1.6** [KULLANICI (a) + YAYGIN] Geri al: kart kalkar, taşınan tahsilatlar cariye taksit dışı olarak döner; aktarımın açtığı cari kalkar.
- **B1.7** Bağlı carisi olmayan kaydı aktarım kendisi açar (2.4.3 yolu; D = 0 → B1.4 YAYGIN).
- **B1.8** [KULLANICI (c)] Tablodaki Kişiler: bir dosya no'nun tahsilatı sekme sayısından bağımsız **bir kez**; kişinin alacağı = kayıt
  tahsilatları + kayda bağlı carinin **bütün** tahsilatları (5a ile karta taşınanlar dahil — taşıma tutarları değiştirmez); toplam = satırlar
  (ders 11). [YAYGIN] karta doğrudan girilen tahsilat da kişinin tahsilatıdır; aynı adlı iki kişi ayrı satır; satır kişinin adını gösterir (B1.8b).
- **B1.9** [AJAN A9] Ön izlemeden sonra cariye tahsilat girilirse aktarım reddedilir (kart açılmaz).

### B3 — Tablodaki Kişiler BORCU (23.10.2026 03:12 UTC — [KULLANICI] K1–K3, 5 dk yetkisiyle; tur 2'nin [AJAN] B3.2–B3.4'ünün YERİNE, ders 5)
Kaynak: ana oturumun ilettiği kullanıcı kararı metni (31e dar kontrol bulgusu: tur 2 B3.2–B3.4 kodu yazan elden geliyordu; kâhin aynı sekmede tekrar eden dosya
no'yu, dönem sekmelerini ve Kalan'sız iki tutarlı tabloyu üretmiyordu). Ürün kodu okunmadı.
- **K1** [KULLANICI] Borç satır başınadır: AYNI SEKMEDE aynı Dosya No'lu birden çok satır ayrı borç ve ayrı vade kalemidir (Tablodaki Kişiler'de toplanır).
- ~~**K2** [KULLANICI 03:12] FARKLI SEKMEDE aynı Dosya No tek kayıttır, bir kez sayılır; "… bir kez sayıldı" notu (hangi sekme ÇATAL).~~ → **K2 [KULLANICI]
  23.10.2026 04:09 UTC (5 dk yetkisiyle; neden: dönem sekmelerinin — 2025 Aidat / 2026 Aidat — vade kalemleri Takvim'de düşüyordu):** FARKLI SEKMEDE aynı Dosya No
  AYRI borç ve AYRI vade kalemidir (2.4.3 gibi); dört rapor bunu aynı biçimde sayar (K4). Raporda (Tablodaki Kişiler — `rapor:cokSekmeNotu`) ve Tahsilat
  Takvimi'nde (`takvim:cokSekmeNotu`; yalnız bütün vadeler takvim penceresindeyken — K4 koşulu) "N dosya no birden çok sekmede; ayrı sayıldı" notu çıkar. N ÇATAL
  (bütün sekmeler / borç kaynağı sekmeler — yalnız sözü olan sekmenin sayılıp sayılmadığı metinde yok). Not yanıtın herhangi bir metninde aranır (alan adı
  bilinmiyor); not yoksa 0, 03:12 metni ("bir kez sayıldı") görünürse "bir-kez:N", sonu okunamazsa "metin:N" yazılır (tutmaz). İki sekmedeki aynı dosya no'nun
  TAHSİLATI bir kez yazılır (5c — B1.8, değişmez). K1, K3, K4, K5 değişmez. Mutantlar 18 (yalnız ilk borçlu sekme — 03:12 kuralı), 26 (not yok).
- **K3** [KULLANICI] Satırın borcu: Kalan/Kalan Borç/Bakiye sütunu varsa ve hücre doluysa Kalan; Kalan hücresi boşsa toplam (Toplam Borç/Tutar); Kalan sütunu YOKSA
  ve ödenen sütunu (Tahsil Edilen, Ödenen, Ödenen Tutar) ile toplam sütunu (Tutar, Ödenecek Tutar, Toplam) varsa toplam − ödenen, negatifse 0; tek tutar sütunlu
  tabloda (taksit, kira, aidat, ücret, "Ödenecek" dahil) o tutar; gün/adet sütunu ("Kalan Gün", "Adet") tutar değildir; Ödeme Sözü tutarı borç değildir (beklenen
  tahsilattır). [YAYGIN] değerleri tarih olan sütun ("Ödeme Sözü" tarihi) tutar değildir. Tanımsız (birden çok Kalan/toplam/ödenen sütunu; ödenen var toplam yok;
  öncelikli sütun olmadan birden çok tutar sütunu) satır denetlenmez.
- Denetim yalnız carisi ve taksit kartı olmayan, taksit sekmesinde bulunmayan kayıtta. Senaryolar: b3-u2-tablo-borcu, b3b-k1-k4-donem-raporlar,
  b3c-k2-donem-ayni-no (04:09 K2: 2026/301 ve 2026/304 iki sekmede ayrı borç, not 2, K4 6.300 TL); mutantlar 14–18, 23–26.
- DENENMEYEN: "Ödendi" söz hiçbir yerde görünmez; Tahsilat Takvimi penceresi dışındaki vade; dönem süzgecinin kendisi (K4 geniş dönemle).

### B3c — Tablodaki Kişiler kişi gruplaması (C3 [KULLANICI] 23.10.2026; 31e kontrol turu 3 C3 + bağımsız dar kontrol D1 — kâhin yakalamamıştı: kapsam boşluğu)
Kaynak: ana oturumun ilettiği karar metni (kodu yazanın raporu değil — GÖZDEN GEÇİRME 5 (4)). Ürün kodu okunmadı.
- **C3** [KULLANICI] Carisi olmayan tablo kayıtlarında rapor satırı KİŞİdir: aynı ad + farklı TCKN/VKN = farklı kişi (ayrı satır, etikette kimlik — `rapor:<no>:etiketKimlik`
  = etiketteki 10–11 haneli sayı); aynı ad + aynı kimlik = aynı kişi; FARKLI ad + AYNI kimlik = FARKLI kişiler (kimlik yalnız aynı adı ayırır; 11111111111, 0000000000,
  2222222222 gibi yer tutucu ya da gerçek TCKN birçok kişide geçebilir); kimliği olmayan satır, aynı adın tek kimliği varsa o kişiye katılır (kimlik sütunu olmayan
  başka sekmedeki satır dahil). [YAYGIN] kimliği hiç olmayan aynı ad tek kişidir. Denetimler: `rapor:<no>:grup` (borçlu dosya no'nun rapor satırındaki borçlu dosya
  no'lar), `rapor:<no>:borc` artık KİŞİ toplamı (aynı kişiye düşen dosya no'ların borcu), carisiz kaydın `alacak`ı da kişi toplamı.
- **KİMLİKSİZ SATIR** [baş mimar kararı 23.10.2026, C3 tamamlayıcısı — İNCELE 1'in yerine]: kimliksiz satır, adın tek kimliği varsa ona katılır; adın birden çok kimliği
  varsa AYNI Dosya No'yu taşıyan kimlikli satırın kişisine katılır (kimlik sütunu olmayan başka sekmedeki satır dahil); o da yoksa adın KİMLİKSİZ GRUBU olarak ayrı kişi
  kalır (etikette kimlik yok — `etiketKimlik` ""). Mutantlar 30 (tek kimliğe katılmaz), 32 (çok kimlikli adın kimliksiz kaydı ilk kimliğe katılır).
- **KİMLİK SÜTUNU TUTAR DEĞİLDİR** [baş mimar kararı 23.10.2026 — İNCELE 2'nin yerine]: başlığı kimlik/numara bildiren sütun ("Vergi No", "Vergi Numarası", "Vergi Kimlik",
  "VKN", "TCKN", "TC Kimlik No", "Kimlik No"; yoklamada tanınan "TCKN/VKN", "TC Kimlik No / VKN" de) sağlama hanesi tutmasa da tutar sayılmaz, borca girmez; sağlama
  hanesi tutmayan değer kişi gruplamasında kimlik sayılmaz (ad kuralı geçer). Sağlama: TCKN (NVİ: 10. ve 11. hane) ve VKN (GİB: 10. hane) — model `tckn_gecerli`,
  `vkn_gecerli`; yer tutucular 11111111111, 0000000000, 2222222222 sağlama hanesi tutmaz. "Vergi", "Vergi Tutarı", "KDV" başlıklı para sütunları tutardır (bu kümede değil).
  Mutantlar 33 (geçersiz değer de kimlik), 34 (Vergi No / Numarası / Kimlik tutar sayılır).
- TANIMSIZ (denetlenmez): bir kayıtta (dosya no) birden çok ad ya da birden çok geçerli kimlik.
- ORTAM (kara kutu yoklaması, aday 15, 23.10.2026; not defteri c3-yokla): kimlik sütunu başlıkları "TC Kimlik No", "TCKN", "VKN", "TCKN/VKN", "Kimlik No",
  "TC Kimlik No / VKN" tanındı (bu başlıklar tutar sütunu sayılmaz — KIMLIK_BASLIK). "Vergi No" başlıklı tabloda raporda HİÇ satır görünmedi (sütun tutar sayılıyor
  olabilir) — İNCELE idi; baş mimar kararıyla artık kural (yukarıda).
- Senaryo b3d-c3-kisi-gruplama (yer tutucu ve gerçek TCKN farklı adlarda, aynı ad iki kimlik + etiket, aynı ad aynı kimlik, kimliksiz + kimlikli, iki sekmede aynı kişi,
  çok kimlikli adın aynı dosya no'lu kimliksiz satırı ve kimliksiz grubu, "Firmalar" sekmesi "Vergi No" geçerli/geçersiz VKN;
  başlık TC Kimlik No / TCKN); üreteç her tohumda "Üyeler" sekmesi (başlık rastgele: TC Kimlik No / TCKN / Kimlik No; geçerli TCKN denetim haneleriyle; çok kimlikli adın kimliksiz
  satırları; tek kimlikli adda yer tutucu) ve "Firmalar" sekmesi (Vergi No / Vergi Numarası / Vergi Kimlik; geçerli ve bozuk VKN). Mutantlar 28 (aynı
  kimlik farklı adları birleştirir — D1 davranışı), 29 (yalnız ada göre), 30 (kimliksiz katılmaz), 31 (etikette kimlik yok).

### B3d — VERGİ SÜTUNU BORÇ DEĞİLDİR (karar A [KULLANICI] 23.10.2026, 5 dk yetkisiyle)
Kaynak: ana oturumun ilettiği karar metni. Ürün kodu okunmadı.
- **A1** "KDV", "Vergi", "Vergi Tutarı", "Stopaj", "Tevkifat", "ÖTV" başlıklı sütunlar tutardır ama BORÇ SAYILMAZ (model `sutun_sinifi` → "vergi"; başlıkta sözcük kdv/stopaj/
  tevkifat/ötv ya da başlığın tamamı vergi / vergi tutarı; "Vergi No" kimlik sütunudur — B3c).
- **A2** Kalan/ödenen sütunu yoksa ve hem "Tutar" (KDV hariç) hem "Genel Toplam" (KDV dahil) varsa borç GENEL TOPLAM. Kalan Borç önceliği ve "Kalan yoksa toplam − ödenen"
  aynen önce gelir; ödenen sütunu varken "toplam" = Genel Toplam [YAYGIN — hangi toplam metinde yok; denetim etiketi YAYGIN → fark İNCELE].
- **A3** Borç sütunu yine belirlenemiyorsa (ör. iki tutar sütunu: "Aidat" + "Ek Ücret") kişiler raporda NOTSUZ KAYBOLMAZ: `rapor:<no>:gorunurVeyaNot` = kişinin satırı
  raporda var YA DA raporda sekme adını geçen ve borç/tutar/sütun/gösterilmedi diyen ya da "borç/tutar … sütun" kalıplı bir metin (notun alanı ve sözü bilinmiyor).
- Koşucu: `ilk` sütunları ("Fatura No" + "Müşteri"; "Fatura No" tutar değildir — numara sütunu); bu sekmelerin kayıt anahtarı rapordan ADLA çözülür (aynı adlı iki
  kayıt üretilmez). Senaryo b3e-vergi-sutunu (Fatura No, Müşteri, Tutar, KDV, Genel Toplam, Vade + Tahsil Edilen türevi; Tutar + KDV; Ücret + Stopaj; Tutar + ÖTV +
  Tevkifat + Vergi + Vergi Tutarı; Kalan Borç önce; belirsiz iki tutar); üreteç her tohumda "Faturalar" sekmesi (vergi sütunu rastgele, yarı tohumda Tahsil Edilen).
  Mutantlar 35 (eski K3: vergi tutar, Genel Toplam toplam sınıfı → borç belirlenemez), 36 (borç Tutar), 37 (notsuz kaybolur).

### B3e — KAYIT ANAHTARI SÜREKLİLİĞİ (baş mimar kararı 23.10.2026)
- **R1** Sağlaması tutmayan "Vergi No" / "TC" değeri KAYIT KİMLİĞİ sayılmaz: değer silinse ya da değişse de kayıt aynı kayıttır. **R2** Yüklenmiş Dosya No'suz tablo "Yerine
  koy" ile yeniden yüklenince kayda bağlı tahsilat kayıttan kopmaz. Kâhin (kara kutu, AYNI sürüm): yükle → kayda tahsilat → aynı dosyayı Yerine koy → tahsilat aynı kişide
  (`rapor:<no>:alacak`); sonra geçersiz değerler silinmiş dosyayı Yerine koy → tahsilat yine aynı kişide. Dosya No'suz satırın anahtarı ORTAM: "satir:<özet>" (yoklama
  23.10.2026; önizleme bu kayıtları listelemiyor), kâhin anahtarı rapordan adla çözer. Senaryo b3f-kayit-anahtari; mutantlar 38 (Yerine koy tahsilatı koparır), 39
  (geçersiz değer anahtara girer).
- DENENMEYEN (neden): "v2.4.3'te yüklenmiş" tablonun 2.4.4'te Yerine koy'u — kâhin koşucusu TEK program kökünü (KAHIN_PROGRAM_KOKU) içe aktarıp aynı veri klasöründe koşar;
  v2.4.3 → aday geçişi iki ayrı kod kopyasını (git worktree + bağımlılık kurulumu; ders 23/29) aynı veri klasöründe sırayla açmayı ve göçü gerektirir — bu, v2.4.3'ün GERÇEK
  koduyla veri üreten göç takımının (madde 30, goc*) işi; öneri: göç takımına "Dosya No'suz tablo + kayda tahsilat (+ geçersiz Vergi No) → adayda Yerine koy → tahsilat
  aynı kişide" adımı. Kayda bağlı NOT denenmedi (not uç adı bilinmiyor). İNCELE (API): var olmayan kayıt anahtarına (`cases/N1/payments`) tahsilat 200 döndü (yoklama).

### B3f — TABLO BAĞ SÜREKLİLİĞİ (baş mimar kararı 23.10.2026; bağımsız kontrol bulgusu, v2.4.3'te de)
Kaynak: ana oturumun ilettiği karar metni. Ürün kodu okunmadı.
- **(1)** Excel/Sheets tablosunun "Yerine koy", "Devamı olarak ekle" ya da Sheets eşitlemesi kayda bağlı veriyi (kayıt tahsilatı, not, düzeltme, "Ödendi say", cari bağı)
  SESSİZCE koparmaz. **(2)** Güvenli eşleşme: eski ve yeni satır aynı KİŞİ DEĞERİNİ (ad; varsa telefon ya da geçerli TCKN/VKN) taşır ve o değer eski ve yeni tabloda TEK
  satırdadır — ya da AYNI KONUMDAKİ (sekme + sıra) satır aynı kişi değerini taşır; tutar/vade değişse, kolon eklense, sıra değişse de bağ aynı kişide kalır. **(3)** Güvenli
  eşleşme yoksa (aynı adlı iki satırın konumu değişti, ad değişti, satır silindi) önizlemede eşleşmeyen kayıtları ADIYLA söyleyen uyarı + ONAY; eşleşmeyen bağlı veri
  silinmez (yeri kuralda yok → o adın borç/alacak denetimi sonraki adımlarda yapılmaz). **(4)** "Devamı olarak ekle" mevcut kayıtla aynı kişi + aynı tutar görünen satırı
  önizlemede söyler ve onay ister; mevcut satırlar ve bağları yerinde kalır.
- **NETLEŞTİRME** [karar sahibi 23.10.2026]: **(N1)** içeriği tamamen AYNI satır (kişi, tutar, tarih dahil bütün hücreler; boş hücre yok sayılır) mevcut kaydın kendisidir —
  yalnız yeri değişse (aynı adlı iki satırın yer değiştirmesi dahil) ya da Devamı olarak ekle ile yeniden gelse de yeni kayıt açılmaz, bağ yerinde, ONAY ve uyarı yok; onay/uyarı
  yalnız bir bağ ya da kayıt GERÇEKTEN değişecekse (taşınamayan bağ, ikinci kez eklenecek satır). Eşleşme sırası: aynı içerik → tekil kişi değeri → aynı konum. **(N2)** Devamı
  olarak ekle uyarısı içeriği aynı satır için DEĞİL, aynı kişi + aynı tutar ama başka hücresi farklı (ikinci kez eklenecek) satır içindir. **(N3)** önizleme iki seçeneğin
  uyarılarını ayrı taşır; her seçeneğin uyarısı yalnız o seçeneğe göre okunur (koşucu her derinlikte öbür seçeneğin adını taşıyan alt ağacı — ör. `bonds.<öbür>`,
  `preview.<öbür>` — okumaz). Mutantlar 44 (aynı içerik yer değişince eşleşmez), 45 (Devam aynı içerikli satırı ikinci kez ekler + uyarır).
  **(N4)** [karar sahibi 23.10.2026 — Lale Ak durumu KABUL]: Devamı olarak ekle'de GÜVENLİ EŞLEŞEN satır (aynı kişi değeri + iki tabloda tek satır, ya da aynı konum + aynı kişi)
  mevcut kaydın GÜNCELLEMESİdir — ikinci kez eklenmez, bağları kendisinde, uyarı/onay yok (önizlemede "güncellenir" sayısında); "aynı görünen satır" uyarısı + onay YALNIZ
  güvenli eşleşmeyen VE ikinci kez eklenecek (yeni kayıt açılacak) aynı kişi + aynı tutar satırı için — o satır yeni kayıt olarak eklenir (kişinin borcu ikisinin toplamı).
  **(N5)** [karar sahibi 23.10.2026, Mete Er]: "aynı konum + aynı kişi" güvenli eşleşmesi YALNIZ o kişi değeri SEKMEDE iki tabloda da AYNI SAYIDA satırdayken geçerlidir; kişi
  eklenen dosyada (ya da mevcut tabloda) farklı sayıda satırdaysa eşleşme belirsiz → güvenli değil → "aynı görünen" uyarısı + onay; onaylanırsa satırlar YENİ kayıt olarak
  eklenir, mevcut kayıt ve bağları yerinde (Yerine koy'daki konum eşleşmesi de aynı koşulla). Koşucu: aynı ad + aynı GİRDİ tutarlı, raporda ayırt edilemeyen yeni kayıtlar
  başka kayda ait olmayan anahtarlara sıralı atanır (değiştirilebilir; bağlı tahsilatlı kayıtta yapılmaz); yine çözülemeyen kaydın denetimi OKUNAMADI (okuma hatası, fark değil).
  Senaryo b3h t4 (Lale Ak güncellenir; Mete Er eklenen dosyada iki satır, mevcutta bir → ikisi de yeni kayıt + uyarı, Mete Er 3 satır 9.000) ve b3i-devam-ayni-icerik (aynı adlı iki satırdan birinin
  aynısı farklı konumda gelir — öbürü güncellenmez). Mutant 46 (güvenli eşleşen satır güncellenmez, ikinci kez eklenir + uyarı); 45 b3i ile yakalanır. Koşucu: Devam'dan
  sonra BÜTÜN bilinen Dosya No'suz kayıtların anahtarı yeniden çözülür; aynı ad + aynı tutarlı birden çok satırda anahtar çözülemezse değer "anahtar çözülemedi" yazılır. [YAYGIN] değerleri sayı olmayan
  metin sütunu ("Açıklama") tutar değildir (b3h'de borç tanımsız kalıyordu — kâhin hatası, ders 6).
- Denetimler: kayda bağlı tahsilat ve cari bağı kişinin `rapor:<no>:alacak`ında; `adim:<id>:onay` = onaysız commit 200 DEĞİL (program onay istedi); `adim:<id>:uyariAdlari` =
  önizleme (stage) yanıtında — `mapping` (satır yankısı) ve `preview.samples` dışında — ya da onay isteyen commit yanıtında geçen tablo adları. ORTAM (yoklama 23.10.2026):
  Devamı olarak ekle = commit `mode: "merge"`; Dosya No'suz satırın anahtarı satır içeriğinin özeti; onay bayrağının adı bilinmiyor (aday bayraklar denenir; bulunamazsa
  okuma hatası "okunamadı").
- Senaryolar b3g-tablo-bag-surekliligi (Dosya No'suz; tutar + kolon, sıra, ad değişimi + satır silme; aynı adlı iki satır; cari bağı) ve b3h-dosya-no-ve-devam (Dosya No
  ekle / sil, Devamı olarak ekle). Mutantlar 40 (güvenli eşleşmede de kopar), 41 (sessiz), 42 (konum eşleşmesi yok), 43 (Devam çift satırı söylemez).
- DENENMEYEN (neden): Google Sheets eşitlemesi (gerçek Sheets bağlantısı ve ağ gerekir; kâhin ağa çıkmaz); not, düzeltme, "Ödendi say" bağları (uç adları bilinmiyor —
  yalnız kayıt tahsilatı ve cari bağı); eşleşmeyen bağlı verinin "silinmediği" doğrudan okunamadı (rapor eşleşmeyeni göstermez; b3h v3'te aynı içerik geri gelince bağ
  geri göründü — dolaylı); Dosya No'lu tabloda tutar değişimi (anahtar Dosya No).

### B3g — Dar kontrol bulguları (karar sahibi 23.10.2026: N3, N4, N5, N6; kullanıcı kararı A: N1)
- **N3** "Aynı konum + aynı kişi" eşleşmesi YALNIZ kişi değeri sekmede eski ve yeni tabloda TEK satırken geçerli (Mete Er kuralının sıkılaştırılması — tekil kişi değeri kuralının
  içinde; ayrı konum kuralı kalktı, eski "aynı sayıda" kuralı mutant 42). Aynı adlı iki kişi yer değiştirip tutarları değişirse (ya da biri değişirse) bağ HİÇBİR YERE taşınmaz →
  eşleşmeyen uyarısı + onay; bağ yanlış kişiye gitmez: o kişinin rapordaki tahsilatı (0 dahil) denetlenir. Senaryo b3j-ayni-ad-takas; b3g v2 (aynı adlı satırın tutarı değişir).
- **N4** Vergi kolonu (KDV, Vergi, Vergi Tutarı, Stopaj, Tevkifat, ÖTV) YALNIZ tabloda başka bir tutar kolonu varken borç dışıdır; tek tutar kolonu vergi kolonuysa o borçtur
  ("Vergiler": Vergi Tutarı + Son Ödeme). Bütün tablo raporları (Kişiler, Vadeler, Nakit Akışı, Takvim) aynı borcu gösterir (K4). Senaryo b3k-vergi-tek-kolon; mutant 47.
- **N5** "Sheet'te Olmayanları Kaldır" ve kayıt kaldıran her yol bağlı veri varsa adlı uyarı + onay ister. Kara kutudan denetlenen yol: Yerine koy'da satır silme (b3g t4 Deniz Ay —
  uyarı + onay). DENENMEYEN: "Sheet'te Olmayanları Kaldır" (Google Sheets eşitlemesiyle oluşan "tabloda olmayan" kayıt — kâhin Sheets'e bağlanamaz, ağa çıkmaz; uç adı da
  bilinmiyor) ve öbür kaldırma yolları (uçları bilinmiyor).
- **N6** Tabloda artık olmayan (eski karttaki) kayda yazım reddedilir (409), sessizce kaybolmaz. Kara kutudan: kayıt tahsilatı (b3g p7 — Yerine koy'la çıkan Deniz Ay'ın eski
  anahtarına); not / telefon / haciz / belge / görev / düzeltme uçları bilinmediğinden DENENMEDİ. Mutant 48.
- **N1** (kullanıcı kararı A, 5 dk yetkisiyle 23.10.2026) Dosya No'lu (ya da kimlik kolonlu) tabloda her kayıt KENDİ dosya numarasıyla (kimliğiyle) tanınır. Dosya numarası değişen
  kayıtta (2026/101 kapanır, aynı kişiye 2026/150 açılır) bağlar (tahsilat, not, düzeltme, haciz…) yeni dosyaya TAŞINMAZ, eski dosyada kalır; Yerine Koy onayı kalkacak dosyanın
  bağlarını ADIYLA söyler. Aynı dosya numarası geri gelirse bağları yeniden görünür. Kişi eşleşmesiyle taşıma YALNIZ Dosya No'suz (kimlik kolonsuz) tablolarda. Kâhin: Dosya No
  kolonlu sekmede bağ yalnız aynı dosya numarasının TEK satırına gider; yoksa eşleşmeyen uyarısı + onay ve bağ "eski dosyada" bekler (raporda yeni dosyanın tahsilatı 0); dosya
  numarası geri gelince bağ o satırın raporunda yeniden görünür (eski satırların bağları yerleştikten SONRA). Kimlik kolonlu tabloda aynı kural geçerli kimlikle (B3c: geçersiz
  kimlik kimlik değildir). [YAYGIN yorum] Yeni tabloda Dosya No kolonu HİÇ yoksa (sekme Dosya No'suz hâle geldiyse) kişi eşleşmesi — karar bu durumu söylemiyor, senaryoda yok.
  Senaryo b3m-dosya-no-degisimi (icra sekmesi Gül Ak 2026/101 → 2026/150 → 2026/101, Hakan Er 2026/102 tutarı değişir — bağ aynı dosyada kalır; Üyeler sekmesi TC Kimlik No'lu
  Rana Ok kimliği 10000000146 → 12345678950 → geri). Mutant 49 (N1 öncesi: kişi eşleşmesiyle yeni dosyaya taşınır), 50 (geri gelen dosyanın bağı görünmez). DENENMEYEN: not /
  düzeltme / haciz bağları (uçları bilinmiyor; kara kutudan yalnız kayıt tahsilatı), Sheets eşitlemesi.

### B3h — Bağımsız dar kontrol bulguları (karar sahibi 23.10.2026: Y1, Y2, Y3; aday 18)
- **Y1** Borç kolonu YALNIZ para (tutar) kolonudur: telefon, TCKN/VKN/kimlik, tarih, kişi kolonları ve "Borçlu Telefon", "Borçlu TC", "Borçlu Adres" gibi kişi özniteliği başlıkları
  ASLA borç değildir — başlıkta "borç" geçse de. Kâhin: başlığın bir kelimesi kişi özniteliğiyse (telefon, tel, gsm, cep, tc, tckn, vkn, kimlik, adres, ad, soyad, unvan, tarih;
  [YAYGIN] e-posta / mail) kolon tutar adayı değildir. Borç kolonu yoksa (yalnız kişi / tarih kolonları; söz de yok) ya da iki tutar kolonu varken Kalan / toplam yoksa
  (Tutar + Masraf) borç YOK (bütün raporlarda 0) ve satır görünür ya da raporda görünür not. Bütün tablo raporları (Kişiler, Vadeler, Nakit Akışı, Tahsilat Takvimi — K4) ve
  "önce cari açın" Açılış Bakiyesi aynı borcu kullanır. ORTAM: form Açılış Bakiyesi'ni Tahsilat Takvimi kaleminin Kalan Borç'undan doldurur (kalem `debt`, kayıt anahtarı
  `caseKey` — kara kutu yoklaması 23.10.2026; kaynağı test adı/açıklaması, ürün kodu okunmadı); `debt` null = Açılış Bakiyesi boş gelir ("boş"; formun tutara düşüp düşmediği
  kara kutudan bilinmiyor — ekrandan doğrulanır). Kâhin tek satırlı, carisiz, vadesi dolu serbest kayıtta `<kontrol>:acilis:<no>` = satır borcu denetler (borç 0 / borçsuz
  satırda 0 ya da boş; kalem yoksa 0; raporlar: true kontrollerinde). Senaryo b3n-borc-kolonu-kisi-ozniteligi; mutant 51 (kişi özniteliği tutar), 52 (iki tutarda ilk kolon borç), 55 (Açılış Bakiyesi ilk
  tutar hücresinden). Yan etki: b3g'nin boş "E-posta" kolonu artık tutar adayı değil → o tabloda borç Tutar (önceden belirlenemez — yalnız görünürlük denetleniyordu).
- **Y3** Seyrek Kalan Borç: Kalan hücresi BOŞ satırda borç satırın ana tutarıdır (Toplam / Genel Toplam — ikisi birden varsa Genel Toplam [YAYGIN, karar A ile aynı yön; senaryoda
  yok]; yoksa tek tutar kolonu, ör. "Aidat"); ana tutar belirlenemiyorsa (Aidat + Gecikme Faizi iki aday) görünür not, borç yok (Y1'in "not, borç yok" ifadesiyle aynı);
  satır hiçbir raporda notsuz kaybolmaz, bütün raporlar aynı. Senaryo b3o-seyrek-kalan; mutant 53 (Toplam yoksa belirlenemez — Aidat kullanılmaz), 54 (iki adayın toplamı),
  17 (Kalan boşsa 0) de bu senaryoda.
- **Y2** Aynı adlı iki satır telefonla (ya da geçerli TCKN/VKN ile) ayırt ediliyorsa ve (ad + telefon) iki tabloda da tek satırsa güvenli eşleşmedir: tabloya kolon eklense ya da
  tutar değişse de (sıra değişse de — tekil kişi değeri kuralı) bağ o kişide kalır, uyarı / onay yok. Senaryo b3p-ayni-ad-telefon (iki Ali Veli telefonla, iki Deniz Ak TC ile;
  Dosya No'suz); mutant 56 (kişi değeri yalnız ad + kimlik). [YAYGIN yorum] Kimliksiz aynı adlı satırların HEPSİ dolu ve farklı telefon taşıyorsa Tablodaki Kişiler'de ayrı
  kişidir (Y2 telefonu geçerli TCKN/VKN gibi ayırt edici sayar; C3 yalnız kimliği söyler) — bu kişilerin borç / grup / tahsilat denetimleri YAYGIN (İNCELE). Telefonsuz aynı ad
  C3 [YAYGIN] gibi tek kişi (b3g, b3j değişmedi). TC ile ayrılanlar ayrı kişi (C3 [KULLANICI]) → tahsilat ayrı satırda (etiket KULLANICI).

### B3i — TAKVİM KALEMİ (baş mimar kararı 23.10.2026; dar kontrol gerilemesi, aday 19)
- Tahsilat Takvimi / zil / Vade Takip / Nakit Akışı'ndaki vade kaleminin tutarı O VADEDE ödenmesi gereken tutardır. Satırın kendi dönem / taksit tutarı kolonu (Taksit Tutarı, Aidat,
  Kira, Aylık Ücret…) varsa kalem = min(dönem tutarı, satırın Kalan Borç'u); Kalan boşsa (ya da Kalan kolonu yoksa) dönem tutarı; dönem tutarı kolonu yoksa satır borcu.
  Tablodaki Kişiler ve "önce cari açın" Açılış Bakiyesi satır borcunu (Kalan) gösterir. K4 "dört rapor aynı borç" SATIR BORCU içindir, kalem toplamı için değil: kâhin
  `k4:kisiler` = satır borçları toplamı, `k4:takvim` / `k4:vade` / `k4:akis` = kalem tutarları toplamı; tek satırlı kayıtta `<kontrol>:kalem:<no>` (takvim kalemi `amount`).
- Dönem kolonu: para kolonu + başlığın bir kelimesi "taksit", "aidat", "kira", "ücret", "aylık" ile başlar ("dönem", "abonelik" [YAYGIN]); kişi özniteliği / tarih kolonu değil
  ("Sonraki Taksit Tarihi" değil). Birden çok dönem kolonu → kalem tanımsız (denetlenmez). Borçsuz (Y1 not) satırda dönem kolonu yoksa kalem 0.
- Y3 ↔ TAKVİM KALEMİ (karar sahibi, 23.10.2026 çatal kararı): Y3'ün iki adaylı satırında (Aidat + Gecikme Faizi, Kalan boş) TAKVİM KALEMİ geçerli — Takvim / Vade / Nakit
  kalemi dönem tutarı Aidat (b3o Murat Al 800 → Takvim 4.000); Y3'ün "ana tutar belirlenemez → not, borç yok" kuralı SATIR BORCU içindir (Tablodaki Kişiler, Açılış Bakiyesi —
  not kalır). Çatal kaldırıldı.
- Senaryo b3q-takvim-kalemi (Kaan Uz Taksit Tutarı 1.000 / Kalan 9.000 → kalem 1.000, Kişiler 9.000; Aidat 1.000 / Kalan 400 → kalem 400; Aidat 1.000 / Kalan 2.500 → kalem
  1.000); mutant 57 (kalem = satır borcu — önceki kâhin kuralı), 58 (min alınmaz), 59 (Kişiler kalem tutarını gösterir). Önceki senaryolarda kâhinin K4 değerleri değişmedi
  (dönem kolonlu satırlarda Kalan dönem tutarından küçüktü ya da Kalan kolonu yoktu); yalnız b3o Murat Al'ın kalemi 800 (Takvim / Vade / Nakit 4.000).

### B3j — Z2, Z3 (karar sahibi 23.10.2026; dar kontrol, aday 20)
- **Z2** Kalan Borç hücresi SAYI ve 0 ya da EKSİ (fazla ödeme) olan satırda vade kalemi YOKTUR: Takvim, Vade Takip, Nakit Akışı'nda görünmez, gecikmiş sayılmaz (min(dönem tutarı,
  Kalan) ≤ 0). Kâhin: o satırın kalemi 0 ve `<kontrol>:kalemVar:<no>` = false (Takvim'de kaydın kalemi yok). Eksi Kalan'ın Tablodaki Kişiler'deki borcu ve Açılış Bakiyesi
  kararda yok → kişi denetlenmez, K4 Kişiler toplamı ÇATAL (eksi ya da 0) [YAYGIN]. Senaryo b3r-kalan-sifir-eksi (Ali Veli Aidat 1.000, Kalan −100, vade 2 gün önce; Kalan 0;
  dönem kolonsuz −250); mutant 60. DENENMEYEN: Vade Takip / Nakit Akışı'nda tutarı 0 satırın GÖRÜNÜP görünmediği (yalnız toplam okunuyor).
- **Z3** Ödeme sözü kalemi SÖZ TUTARIdır, satırda Taksit Tutarı da olsa (Taksit Tutarı 1.000, Kalan 9.000, Söz Tarihi, Söz Tutarı 3.000 → söz kalemi 3.000); söz tutarı hücresi
  boşsa önceki kural (min(dönem tutarı, Kalan)). Kişiler / Açılış Bakiyesi satır borcu (Kalan) — söz tutarı borç değil (K3). Senaryo b3s-soz-tutari-kalemi; mutant 61.
  [YAYGIN] Z2 söz kalemine de uygulanır (Kalan ≤ 0 → kalem yok) — senaryoda yok.

### B3k — SÖZ TUTARI sütunu (karar sahibi 23.10.2026; dar kontrol YÜKSEK gerilemesi, aday 21)
- Söz sütunu YALNIZ ödeme sözü / taahhüt tutarıdır ("Söz Tutarı", "Ödeme Sözü Tutarı", "Taahhüt Tutarı"); "Sözleşme Tutarı", "Sözleşme Bedeli", "Sözleşme No", "Sözleşme Tarihi"
  SÖZ DEĞİLDİR — sözleşme bedeli dönem / taksit tutarı da değildir; borç Kalan'dan gelir. Tahsilat Takvimi, Vade Takip, Nakit Akışı aynı. KÂHİN DÜZELTMESİ: kâhinin sütun
  sınıflandırması da "söz" ile BAŞLAYAN her kelimeyi söz sayıyordu ("sözleşme" dahil — aynı kusur; senaryolarda sözleşme başlığı olmadığı için görünmedi) → artık yalnız
  "söz / sözü / taahhüt / taahhüdü" kelimesi (eski önek kuralı mutant 62). Önceki senaryolarda kâhinin değerleri değişmedi.
- Senaryo b3t-sozlesme-tutari (Ali Kaya 50.000 / 9.000 / söz 3.000 → söz kalemi 3.000; Ayşe Demir 40.000 / 2.000 / söz boş → kalem 2.000; Can Yıldız söz sütunsuz sekmede
  60.000 / 5.000 + Son Ödeme → kalem 5.000; Deniz Ok Sözleşme No 1024 + Sözleşme Bedeli 30.000 / Kalan 4.000 → kalem 4.000; Kişiler 20.000, Takvim / Vade / Nakit 14.000).
- SÖZLEŞME TARİHİ (karar sahibi 23.10.2026): "Sözleşme Tarihi" vade / son ödeme / söz tarihi DEĞİLDİR, vade kalemi açmaz (sözleşmenin başlangıç tarihi). Kâhin: vade kalemi
  yalnız tarih değerli, başlığında "sözleşme" geçmeyen kolonun dolu hücresinden açılır; yalnız Sözleşme Tarihi dolu satırın kalemi yok (`kalemVar` false, Takvim / Vade / Nakit'e
  katılmaz, Kişiler'de borç). Senaryo b3u-sozlesme-tarihi-soz-basliklari (Ece Ak Sözleşme Tarihi + Son Ödeme → tek kalem 3.000; Fuat Er yalnız Sözleşme Tarihi → kalem yok;
  "Ödeme Sözü Tutarı" 2.500 ve "Taahhüt Tutarı" 1.800 söz kalemi); mutant 63 (Sözleşme Tarihi kalem açar), 64 (yalnız "Söz Tutarı" söz). DENENMEYEN: öbür başlangıç tarihleri
  ("Kayıt Tarihi", "Başlangıç Tarihi" — kararda yok).

### B3l — ÖDEME SÖZÜ başlıkları (karar sahibi 23.10.2026; aday 22)
- Söz ailesi TAM sözcük ("Söz", "Sözü", "Ödeme Sözü"); TAAHHÜT ailesi ÖNEK ("Taahhüt", "Taahhüdü", "Taahhütname", "Taahhütlü" — hepsi söz); yalnız "Sözleşme…" söz değildir
  (B3k). Söz TUTARI sütunu söz / taahhüt sözcüğü + "tutar" YA DA "miktar" sözcüğü taşır ("Söz Tutarı", "Söz Miktarı", "Taahhüt Miktarı"); [YAYGIN] tutar / miktar sözcüğü
  olmayan söz-ailesi sütunu para kolonu değildir. Söz tutarından gelen kalem ödeme sözü kalemidir (`<kontrol>:kalemSoz:<no>` = takvim kalemi `promise`).
- Senaryo b3v-taahhut-soz-miktari (Kalan 2.500, "Taahhütname Tarihi", "Taahhüt Tutarı" 500 → söz kalemi 500; Kalan 3.000, "Söz Tarihi", "Söz Miktarı" 600 → 600; "Ödeme Taahhüdü
  Tarihi / Tutarı" 800; "Taahhütname Miktarı" 900); mutant 65 (taahhüt tam sözcük), 66 (yalnız "tutar"). DENENMEYEN: "Taahhütlü …" başlığı (söz tarihi olmayan sekmede söz
  kaleminin tarihi kararda yok), "Söz" / "Ödeme Sözü" sayı değerli tutar sözcüksüz sütun.

### B3m — Yalnız söz tutarlı sekme (A1 + B3l) ve "Taahhütlü Ücret" (5b) (ana oturum, 23.10.2026; aday 22)
- A1 ("Ödeme Sözü tutarı borç değil — beklenen tahsilat") + B3l: borç sütunu olarak YALNIZ söz tutarı sütunu bulunan sekmede ("Taahhüt Tutarı", "Taahhütname Tutarı", "Söz Miktarı",
  "Ödeme Sözü Tutarı") Tablodaki Kişiler borcu 0 (borç sayılmaz) ve "önce cari açın" Açılış Bakiyesi 0 / boş; Takvim / Vade / Nakit'te ödeme sözü kalemi (`kalemSoz` true) söz
  tutarıyla. Kural metni Kişiler'de ne gösterileceğini söylemiyor → yalnız "borç 0" denetlenir (görünür not denetlenmez — Y1'in "borç kolonu yoksa not"u söz-yalnız sekmeye
  uygulanır mı yazılı değil: DENENMEYEN).
- "Taahhütlü Ücret" + Kalan (5b): söz/taahhüt ailesi + dönem sözcüğü, tutar/miktar sözcüğü YOK → söz tutarı DEĞİL; ücret borç / dönem tutarı olarak kalır (Kalan doluysa borç
  Kalan, boşsa ücret — Y3; kalem min(ücret, Kalan)); kalemi düz vade kalemi (`kalemSoz` false). KÂHİN DÜZELTMESİ: B3l'deki [YAYGIN] "tutar/miktar sözcüğü olmayan söz-ailesi
  sütunu para kolonu değildir" yorumu bu satırda yanlıştı (ücret hiç sayılmazdı) → dönem sözcüğü taşıyan söz-ailesi başlığı normal sınıflandırılır; dönem sözcüğü de yoksa
  (yalın "Ödeme Sözü" sayı sütunu) para kolonu değil [YAYGIN]. Önceki senaryolarda kâhinin değerleri değişmedi.
- Senaryo b3w-yalniz-soz-tutari (Ada Er 700, Bora Ak 800, Cansu Ok 900, Doruk Tan 1.000 — her biri ayrı sekme; Selin Ak 1.200 / 3.600, Tarık Su 1.500 / boş; Kişiler 5.100,
  Takvim 6.100); mutant 15 (söz tutarı borç — K3) bu senaryoda da, 61 (söz kalemi söz tutarı değil), 67 ("Taahhütlü Ücret" para değil), 68 ("Taahhütlü Ücret" söz tutarı).

### B3n — Yalın söz sütunu ve "Tutar" + söz tutarı (ana oturum, 23.10.2026; A1 + K3 "tek tutar sütunu borç" + Z6; aday 22)
- (a) Borç sütunu olarak yalnız YALIN sayı değerli söz-ailesi sütunu ("Ödeme Sözü", "Söz", "Taahhüt" — tutar / miktar / dönem sözcüğü yok) olan sekme: Kişiler borcu 0, Açılış
  Bakiyesi 0 / boş; söz kalemi bu sütundan tutar ALMAZ (kalem 0). Kâhin: yalın söz sütunu `soz_yalin` sınıfı — söz tutarı değil, borç değil, sekmede söz olduğunu söyler (yalnız
  söz → borç 0, not denetlenmez; B3l/B3m'deki [YAYGIN] "para kolonu değildir" yorumu böylece karar oldu).
- (b) "Tutar" + "Söz Tutarı" ve "Tutar" + "Taahhütname Tutarı": borç "Tutar"dan (söz tutarı borç değil → tek tutar sütunu), söz kalemi söz tutarından, "borç sütunu belirlenemedi"
  türü not YOK (`<kontrol>:rapor:<no>:notYok` — sekme adını geçen + "borç sütun / tutar sütun / belirlenemedi / gösterilmedi" metni yok).
- (c) Yalın "Ödeme Sözü" (sayı) + "Borç" + Son Ödeme: borç "Borç"tan, kalem borç; söz tarihi olmadığından kalem düz vade [YAYGIN: `kalemSoz` false].
- Senaryo b3x-yalin-soz-ve-tutar (Kişiler 15.000; Takvim / Vade / Nakit 8.500); mutant 69 (yalın söz sütunu söz tutarı), 70 (yalın söz sütunu tutar); 15 ve 61 bu senaryoda da.

### B3o — Borç ailesi sözcüklü söz-ailesi başlığı yalın söz değildir (ana oturum, 23.10.2026; Y1 + N4 + K3; aday 23)
- KÂHİN DÜZELTMESİ (ders 5 — B3n'deki (a) yorumumun eksiği; dar kontrol programda buldu, aynı yanlış kâhinde de vardı): söz/taahhüt ailesi başlığı dönem ya da tutar/miktar
  sözcüğü taşımasa da borç / alacak / kalan / bakiye / toplam ailesinden sözcük taşıyorsa ("Taahhüt Alacağı", "Taahhüt Bakiyesi"; ekli biçimler — alacağı, bakiyesi — YALNIZ bu
  muafiyette) yalın söz DEĞİLDİR: kalan / bakiye → Kalan (N4 "'Bakiye' Kalan sayılır", K3 Kalan önceliği); borç / alacak / toplam → borç sütunu (Y1 "borç kolonu yalnız para
  kolonudur"). Genel borç kalıpları (ör. "Bakiyesi" tek başına) genişletilmedi. Önceki 32 elle + 2 rastgele senaryoda kâhinin beklediği değerler DEĞİŞMEDİ (HEAD modeliyle bayt bayt).
- "Taahhüt Miktarı (Ay)" sayı sütunu söz tutarı değil (K3 gün/adet — ay [YAYGIN, ana oturum "gün/adet/ay sütunu tutar değil kararı"]); söz kalemi önceki kurala düşer (satır borcu).
- Senaryo b3y-taahhut-alacak-bakiye ((a) Kerem Ak 2.200; (b) Leman Er 1.000 / 4.000, Mert Ay 1.000 / 300; (c) Nazlı Su Kalan 5.000, (Ay) 6; Kişiler 11.500, Takvim 8.500);
  mutant 71 (muafiyet yok — yalın söz), 72 ("(Ay)" söz tutarı).

### B3p — BİLİNEN SINIR listesi (ana oturum isteği, 23.10.2026; DONDURMA kararı)
- `BILINEN.json`: ürün sahibinin ERTELEDİĞİ, kâhin beklentisi DOĞRU kalan farklar. Her kayıt TAM ad (senaryo + denetim anahtarı; joker / kalıp karakteri yasak), karar kaynağı,
  kâhinin beklediği ve programın BİLİNEN değeri. Koşucu: listedeki fark "≈ [BİLİNEN]" diye ayrı yazılır, başarısız sayılmaz ("N/M denetim geçti (B bilinen sınır dahil)",
  ÖZET'te ve ozet.json `bilinen` alanında ayrı sayı); program ya da kâhin değeri listedekinden farklıysa BAŞARISIZ ("BİLİNEN DEĞİŞTİ"); listede olup farkı kalmayan (ya da
  denetimi olmayan) kayıt BAŞARISIZ ("BİLİNEN KAPANDI — listeden çıkar"); liste dışı her fark BAŞARISIZ; geçersiz kayıt (alan eksik, joker, çift, senaryosu yok) BAŞARISIZ.
- Liste mutantları (her koşuda, program açılmadan, sentetik durumlarda): 1 senaryo adı yok sayılır, 2 alt dizgi (joker) eşleşmesi, 3 program değeri karşılaştırılmaz,
  4 kapanan kayıt denetlenmez, 5 kâhin beklentisi karşılaştırılmaz — yakalanmayan liste mutantı "yakalanmayan mutasyon" sayılır (çıkış 1).
- ŞİMDİKİ KAYITLAR (5): b3y (b) "Taahhüt Bakiyesi" — DONDURMA 23.10.2026, 2.5.0 adayı 2 (ek biçim "Bakiyesi" — Kalan tanınması; ürün v2.4.3'te ve aday 22'de de tanımıyor).
  (a) "Taahhüt Alacağı" ERTELENMEDİ (ana oturum: R1 gerilemesi, tur 16 ürününde düzelir) → listede yok, BAŞARISIZ kalır. GÜNCEL (aday 24 = tur 16, 550c2b0; ham kalemden):
  11 kayıt — Leman Er / Mert Ay Kişiler borcu 0 + grup [] (sekme borçsuz + görünür not "borç sütunu seçilemedi (Aylık Ücret, Taahhüt Bakiyesi)"), Açılış Bakiyesi boş, Mert Ay
  kalemi 1.000 (kâhin 300); K4 Kişiler 720.000 (kâhin 1.150.000; fark yalnız (b) 4.000 + 300), Takvim / Vade / Nakit 920.000 (kâhin 850.000; fark yalnız Mert Ay 700). (a) ve (c)
  aday 24'te kapandı. ESKİ (aday 23): (b): Leman Er
  Kişiler / Açılış 1.000 (kâhin 4.000), Mert Ay Kişiler / Açılış / kalem 1.000 (kâhin 300). Değerler aday 23'ün (439eb2d); tur 16 ürününde YENİDEN DOĞRULANACAK. K4 toplamları
  bilerek listede değil ((a) "Taahhüt Alacağı" ve (c) "(Ay)" farklarını da taşıyorlar — ertelenmedi); tur 16'dan sonra yalnız (b) payı kalırsa o ürünün değerleriyle eklenir.

### B4b — Dört rapor aynı satır borcu (K4 [KULLANICI] 23.10.2026; TAKVİM KALEMİ ile daraldı — B3i)
- **K4** Tablodaki Kişiler (totals.debit), Tahsilat Takvimi (/dues Σ amount), Vade Takip (totals.amount) ve Nakit Akışı Beklenen (totals.expected) aynı satır
  borcunu kullanır; toplamları aynıdır (dönem süzgeci içinde). Kontrol adımında `"raporlar": true` ve bütün kayıtların borcu tanımlı ve tek değerliyse dört
  toplamın her biri Σ satır borcuna eşit beklenir. Senaryoda bütün satırların vadesi ("Ödeme Sözü" tarih sütunu) takvim penceresinde (bugün + 3); Ödeme Sözü
  tutarı ve fatura/taksit kaynağı olan senaryoda denetlenmez.

### B5b — Kasa yetkisi olmayan kullanıcı (K5 / Y1 [KULLANICI] 23.10.2026)
- **K5** Kasa'yı görme yetkisi olmayan kullanıcı Nakit Akışı'nda Kasa giriş/çıkışını görmez (boş/gizli + not). `kullanici_ac {ad, rol, kaldir}` (rol "avukat"
  Nakit Akışı'nı açar; `cash.view` kaldırılır — kara kutu yoklaması); beklenen `yetkisiz:<ad>:kasa` = "gizli" (cashIn ve cashOut null/yok), `yetkisiz:<ad>:not`
  = yanıtta "Kasa" ve "yetki/göreme/görüntüle/gizli" geçen metin. Mutant 27. Kurulum denetimi (ders 38): kullanıcı adı `kahin-<ad>` (program 3–60 karakter ister);
  bu kullanıcıya Kasa sayfası (`GET /api/workspace/cash`) 200 dönerse yetki kaldırılamamıştır → okuma hatası (K5 denetimi geçersiz), fark sayılmaz.
- (B3 okuma) Tablodaki Kişiler dosya no başına borç (`rapor:<no>:borc`) GENİŞ dönem raporundan okunur (2000-01-01 – 2099-12-31): kâhin satır borcunu tarihe bakmadan
  hesaplar; tarih sütunu (ör. Ödeme Sözü bugünden sonra) satırı yıl başı–bugün süzgecinin dışına düşürebilir (ilk koşuda b3b'de bütün satırlar 0 okunmuştu — kâhin
  hatası, ders 6). Tahsilat (`alacak`) ve tutarlılık yıl başı–bugün raporundan kalır.

### B4 — Nakit Akışı Kasa giriş/çıkış = Kasa raporu (31b MM6; 23.10.2026)
- **B4.1** [KULLANICI] CLAUDE.md Açık iş 22.10 21:21→21:27 UTC "MM6 Nakit Akışı Kasa giriş bütün nakit hareketleri"; ana oturumun kural metni "Nakit Akış'ın Kasa
  giriş/çıkışı Kasa raporuyla aynı toplam: yalnız nakit, bütün kaynaklar". Her kontrolde yıl başından bugüne: Nakit Akışı (cashIn/cashOut) = Kasa raporu (nakit;
  in/out) = kâhinin nakit hareketleri (cari nakit tahsilatı, kayıt tahsilatı, kart tahsilatı, alınan evrakın tahsili; çıkış: carisiz elle Kasa çıkışı `kasa_cikis {tutar, tarih}` — [YAYGIN TDHP] B 770 / A 100); havale (`yol: "havale"`) Kasa'ya girmez.

### B5 — Nihai Tüketici carisi (31f U1; 23.10.2026)
- **B5.1** [KULLANICI] CLAUDE.md Açık iş 22.10 21:41 UTC (b) "'Nihai Tüketici' … → kendi işaretli carisi, adı belli caride 11111111111 uyarısı": faturadaki Nihai Tüketici
  yalnız programın işaretli carisini kullanır; adı belli 11111111111'li cari ASLA seçilmez.
- **B5.2** [AJAN] İşaretli cari silinmemiş, TCKN 11111111111 ve adı "Nihai Tüketici" olur; işaretli yoksa (ya da bu koşulları yitirdiyse — yeniden adlandırma, silme)
  bu koşulları taşıyan EN ESKİ cari benimsenir, o da yoksa yeni açılır. Yazım farkı ("nihai tüketici"), kimlik değişimi ve geri yüklenen eski işaretli DENENMEZ.

### B2 — UX18 çek/senetle fatura kapama (madde 15)
- **B2.1** [KULLANICI KARARLAR (2) + PLAN §8.10/§4.3] Her cari için son durumdan: bağlı satırlar (Kapatılacak Fatura'lı nakit, faturaya bağlı
  alınan evrak, faturanın kendi evrakı) kendi faturasını kapatır; [AJAN] fazlası havuza; havuz (bağsız tahsilat + bağsız evrak + fazlalar) taksitsiz
  satış faturalarını **en eskiden** (belge tarihi, eşitse yazım sırası) kapatır; artan avanstır. Satıştan iade SENARYO-DILI §7 kural 5–6.
- **B2.2** [KULLANICI 22.10 madde 15 kararı] Karşılıksız evrak hiçbir faturayı kapatmaz (bağlı, kendi evrakı ve faturayla ciro dahil) → fatura
  yeniden açılır; cari bakiye karşılıksızla değişmez (alacak geri gelir). [AJAN değişmez] Σ açık = cari bakiye (bağsız evrak karşılıksızında da;
  kullanıcı kararı bağsızı açıkça anmıyor → İNCELE).
- **B2.3** [PLAN §3.11a] Tahsil ve ciro faturayı açmaz (müşterinin alacağı evrakla kapanmıştır).
- **B2.4** [KULLANICI] Taksitli faturaya, başka carinin faturasına ve ters yöne (alış faturası) bağ kurulmaz → ret, hiçbir satır yazılmaz;
  [AJAN] iade/taslak/iptal 409, başka cari 404, carisiz evrak 400. [YAYGIN] faturanın kendi (peşin) evrakının bağı değiştirilemez.
- **B2.5** [KULLANICI] Fatura iptal → evrak portföyde kalır, bağ düşer, evrak bağsız olarak en eski açığı kapatır; [YAYGIN] faturanın kendi evrakı
  faturayla kalkar; işlem görmüş kendi evrakı varken iptal reddedilir.
- **B2.6** [PLAN §3.11a] Yevmiye: alınan çek B 101 / A 120, senet B 121 / A 120; karşılıksız tersi; tahsil B 100 / A 101|121; ciro B 320 / A 101|121;
  satış (KDV 0) B 120 / A 600; nakit tahsilat B 100 / A 120; [YAYGIN TDHP] açılış B 120 / A 500. Kayıt tahsilatı, kart ve elle borç olan
  senaryoda mizan denetlenmez (karşı hesapları kaynakta yok).

## 4. Nasıl bozulur? (önce yazıldı; senaryo karşılıkları)

| # | Bozulma | Senaryo |
|---|---|---|
| N1 | Sıra: tahsilat tarih sırası ≠ yazım sırası; tahsilat açılıştan önce/sonra | b1-5a-tasima (Burak: 10.05 tahsilatı sonra yazıldı) |
| N2 | Kartı aşan tahsilat bölünür / sonraki küçük taşınır | b1-5a-tasima (Burak, Selin) |
| N3 | Çift borç (açılış + kart), kısmi borç, faturalı cari, seçenek kapalı | b1-5b-borc |
| N4 | Aynı dosya no iki sekmede (çift sayım), aynı adlı iki kişi, karta taşınan tahsilat rapordan düşer | b1-5c-rapor |
| N5 | Yarıda kesilme / iki kişi aynı anda: ön izlemeden sonra araya tahsilat | b1-5a-bayat-ve-yeniden |
| N6 | Sil + geri yükle (evrak), geri al + yeniden aktar | b2-ux18-temel, b1-5a-bayat-ve-yeniden, b1-5b-borc |
| N7 | Karşılıksız → yeniden açılma, araya giren avans, kendi evrakı | b2-ux18-karsiliksiz, b2-ux18-sira |
| N8 | Yasak bağlar hiçbir satır yazmaz | b2-ux18-retler |
| N9 | Rastgele sıra (ders 17) | uretici.py tohum 1–N |
| N10 | Eski sürüm (163dd5d) aynı senaryolarla | KAHIN_PROGRAM_KOKU ile kırmızı kanıt |
| N11 | /2 B3: Kalan önceliği kaybolur, Kalan 0/boş, söz borca girer, "Kalan Gün" tutar sanılır, aynı dosya iki sekmede çift sayılır, yüksek öncelik sonraki sekmede | b3-u2-tablo-borcu |
| N12 | /2 B4: Kasa girişinden bir kaynak düşer (kayıt tahsilatı, çek tahsili), havale Kasa'ya girer | b3-u2-tablo-borcu + her rastgele senaryonun kontrolleri |
| N13 | /2 B5: adı belli 11111111111'li cari seçilir; ikinci "Nihai Tüketici" işaretliyi değiştirir; işaretli yeniden adlandırılınca/silinince yine o seçilir | b5-u1-nihai-tuketici |
| N14 | Eski taban (ad865f0, U1/U2/MM6 öncesi) aynı senaryolarla | KAHIN_PROGRAM_KOKU ile kırmızı kanıt (docs/kanit/2026-10-23/244-kahin/) |

Kapsam dışı (senaryo kurmaz): 002 şirketi, yetkisiz kullanıcı, döviz, şüpheli alacaklı cari, taksitli faturalı caride bağsız tahsilat
(SENARYO-DILI BELİRSİZ-7), faturalı caride Excel'de ödenmiş taksit bilgisi, iskontolu/KDV'li fatura (UX18 kuralı tutardan bağımsız).

## 5. Senaryo dili `destekofis-cari/1`

Üst düzey `{dil, ad, aciklama, dayanak, bugun (yyyy-aa-gg; sahte saat 09:00'dan akar), adimlar[]}`. Tutar metin `"1234,56"`. Adımlar:
`tablo_yukle {sekmeler:[{ad, tur: taksit|icra|soz, kayitlar}]}` · `cari_ac {ad, isim, tel, tur, kayit, acilis, tarih}` ·
`tahsilat {cari, tutar, tarih, fatura?}` · `borc` · `kayit_tahsilat {kayit}` · `aktar {ad, kayitlar, hesapIci, mevcutBorc, araya?}` ·
`geri_al {aktar}` · `kart_tahsilat {kayit}` · `fatura {ad, cari, tutar, tarih, tur: satis|alis, taksit?, evrak?, taslak?}` · `iade {ad, fatura}` ·
`evrak {ad, cari|null, tur: cek|senet, tutar, tarih, fatura?}` · `karsiliksiz` · `tahsil` · `ciro {cari}` · `evrak_sil` · `evrak_geri_yukle` ·
`bag_degistir {evrak, fatura|""}` · `fatura_iptal` · `kontrol`.
/2 ekleri: `kullanici_ac {ad, rol, kaldir}`; `kontrol {raporlar: true}` (K4); sekme türü `serbest {basliklar:[…], kayitlar:[{no, isim, hucreler:{başlık: hücre metni}}]}` (koşucu "Dosya No", "Borçlu" + başlıkları AYNEN yazar);
`tahsilat {…, yol: "havale"}`; `kasa_cikis {tutar, tarih}`; `cari_ac {…, tckn}` (gerçek kişi); `nihai_tuketici` (POST /api/workspace/invoices/retail-account); `cari_sil {cari}`;
`cari_adlandir {cari, isim}`. Yeni çıktı anahtarları: `<kontrol>:rapor:<no>:borc`, `<kontrol>:nakit:{kasaGiris,kasaCikis}`, `<kontrol>:kasaRapor:{giris,cikis}`,
`adim:<id>:{secilen,olusturuldu}` (seçilen carinin takma adı; programın açtığı yeni cari `@nt1`, `@nt2`… sırayla), `<kontrol>:cari:<ad>:var` (silinen cari). Geçerlilik: aynı seride fatura tarihleri artan (VUK sıra-tarih; program reddeder).

Çıktı anahtarları: `adim:<id>:durum` (ok/ret), `adim:<id>:http`, `adim:<id>:{olusan,tasinanAdet,tasinanTutar,kapsanan,atlanan}`,
`<kontrol>:cari:<ad>:{bakiye,taksitDisi,var}`, `<kontrol>:fatura:<ad>:{acik,durum}`, `<kontrol>:kart:<no>:{var,toplam,odenen,kalan,mevcutBorc,taksitN:odenen}`,
`<kontrol>:kasa`, `<kontrol>:mizan:<hesap>`, `<kontrol>:rapor:<no>:{alacak,ad}`, `<kontrol>:rapor:tutarli`. Kuruş tamsayı.

## 6. Mutasyonlar (kâhinin dişi)

`model.py --mutasyonlar` listeler (21 adet; /2'de 14–21: U2 Kalan önceliği, söz borç, gün sütunu tutar, Kalan boş → 0, aynı dosya çift borç, MM6 kaynak düşmesi,
U1 en eski 11111111111, U1 işaretli koşulsuz; ilk 13: bölünme, sonraki küçük, D tanımı, kısmi borç, çift sayım, fazlanın havuza gitmemesi, karşılıksızın
açmaması, iptalde bağın düşmemesi, en yeniden kapama, geri almada iade yok, Kasa'nın değişmesi, en yeni taksitten sayma, senedin 101'e yazılması).
Koşucu her mutasyonun senaryo kümesinde en az bir denetimi değiştirdiğini doğrular; değiştirmeyen = YAKALANMADI (çıkış 1). /2: mutasyon kümesi koşulan dosyalar +
BÜTÜN elle senaryolardır (yalnız model koşar) — `--tohum` ile yalnız rastgele UX18 dizileri koşulduğunda (Uzun Doğrulama) da /2 mutantları yakalanır.

## 7. Programla bulunan farklar (22.10.2026, fd0b0fc)

Bkz. `docs/kanit/2026-10-22/244-kahin-cari/` ve teslim raporu. Yeniden üretim: `HUKUK_LICENSE_URL=http://127.0.0.1:9 node --disable-warning=ExperimentalWarning test/bagimsiz/cari/kos.mjs test/bagimsiz/cari/senaryolar/<ad>.json --mutasyonsuz`.

## 8. 2.4.5 kuralları — dil `destekofis-cari/3` (24.10.2026, iş listesi madde 0b "kâhin önce")

### C00 Temiz oda (2.4.5)
- **Okunan kaynaklar:** `docs/2.4.5-IS-LISTESI.md` (Amaç, madde 1, 2, 3, 4, 5, 6; "BAŞ MİMAR KARARLARI" S1, K6.1–K6.4, K1, iş bölümü), CLAUDE.md "Açık iş" (YÖN KARARI;
  KAPI KAPATMA; KARAR ~21:25 / ~21:35 UTC (1)–(6)) ve "Kalıcı ürün kararları" (2.4.4), `docs/BANKA-MODULU-PLAN.md` §8.10 ("Otomatik (En Eski)"), §4.3/2 ("1. adım bağlı,
  2. adım FIFO en eski yükümlülük"), bu klasörün önceki kâhin dosyaları, `test/bagimsiz/SENARYO-DILI.md`.
- **Okunmayanlar:** `server/**`, `client/**`, `test/e2e/**`, `docs/kanit/**`, git geçmişi/farkları, `docs/erp/TABLO-PARA-KOPARMA-PLANI.md` (koddan çıkarılmış envanter).
  `test/*.test.mjs` dosyalarından yalnız İSTEK satırları (uç + gövde) grep ile okundu: `PUT/DELETE /api/workspace/payments/:id` (kayıt tahsilatı düzeltme / silme),
  `PUT/DELETE /api/workspace/accounts/:id/entries/:entryId`, `/api/admin/trash(/restore)`, `/api/admin/backups(/restore)`, `/api/workspace/overview/vade-takip?preset=open`,
  `/api/workspace/overview/nakit-akisi?…&overdue=1&table=0`, `/api/workspace/dues`, `/api/workspace/dues/settle`, `openingSide: "debt"`.
- **Kara kutu yoklaması (yalnız ORTAM — alan adı / yanıt biçimi; kural türetilmedi; 2.4.4 kodu, not defteri `245-kahin-245/yokla/yokla1–4.mjs`):** `/dues` = `{items, deadlines,
  sources, dormant, notes, today, …}`; tablo kalemi kimliği `due|…` (kaynak alanı yok, `caseKey`, `amount`, `debt`); fatura kalemi `invoice|<id>` (`source: "invoice"`,
  `direction`, `amount`, `dueDate` = belge tarihi); çek kalemi `cheque|<id>`; `deadlines[]` (Duruşma Tarihi `event`, Sözleşme Bitiş / İcra Son Tarihi `expiry`, `caseKey`,
  `column`); Vade Takip `rows[]` (`date`, `direction`, `amount`, `source`: invoice / promise / table / cheque / deadline, `ref`); Projeksiyon `rows[]` (+ `overdue`, `table=0`);
  Açılış Bakiyesi bir hareket (`kind` debt / credit, `note` "Açılış bakiyesi", tarih = `registeredOn`; `openingSide: "credit"` kabul); Silinenler kalemi `kind: "account-entry"`,
  `ref` = hareket kimliği, geri yükleme AYNI kimliği verir; kayıt tahsilatı Silinenler `kind: "payment"`; `PUT /cases/:key/payments` → 405; "avukat" rolü `accounts.view`'lü
  (kaldırınca Cari listesi 403, `/dues` 200); `settle {id: "account|…"}` → 400 "Kalem tanınmadı."; yedekten geri yükleme `{staged, restartRequired}` → programın yeniden
  açılışında uygulanır (koşucu aynı veriyle yeniden açar).

### C0 2.4.5 kararıyla GEÇERSİZ /1 /2 senaryoları ve denetimleri (silinmedi)
Kural (`model.py gecersiz_245`): `/1` ya da `/2` dilindeki senaryo bir **kayıt tahsilatı POST** (`kayit_tahsilat`) ya da **Tablodan Aktar** (`aktar`) adımı içeriyorsa 2.4.5 kararıyla
geçersizdir: varsayılan kipte koşulmaz, sayısı ve adları "ATLANAN" satırında yazılır. `--legacy` kipi (K4.1, 24.10.2026): BÜTÜN `/1 /2` senaryoları (geçersizler dahil) + rastgele
UX18, ÜÇ anahtar AÇIK (`legacyCasePayments`, `legacyTableTransfer`, `legacyTableDues`) sunucuda, 2.4.4 kural setiyle; `/3` atlanır.

| Senaryo | Neden geçersiz (2.4.5 kararı) | `--legacy` |
|---|---|---|
| b1-5a-bayat-ve-yeniden, b1-5a-tasima, b1-5b-borc | Tablodan Aktar yazım ucu kapalı (madde 2; KULLANICI (2)) | koşar |
| b1-5c-rapor | Tablodan Aktar + kayıt tahsilatı POST (madde 1–2) | koşar |
| b3-u2-tablo-borcu | kayıt tahsilatı POST (madde 1; KULLANICI (1)) — B3 borç denetimleri `b3b…b3y`'de sürer | koşar |
| b3f-kayit-anahtari, b3g-tablo-bag-surekliligi, b3h-dosya-no-ve-devam, b3i-devam-ayni-icerik, b3j-ayni-ad-takas, b3m-dosya-no-degisimi, b3p-ayni-ad-telefon | bağ sürekliliği (B3e–B3h) kayda bağlı **yeni** kayıt tahsilatıyla ölçülüyordu; 2.4.5'te yeni kayıt tahsilatı girilemez (eski veri DONDURULUR, göç yok — Kapsam dışı) | koşar |

Geçersiz DENETİMLER [BAŞ MİMAR K4.1 — /2 B4, B5b ve takvim denetimleri KS4 / madde 4 kararıyla bilerek ayrışır; senaryo koşar, denetim varsayılan kipte YAZILMAZ, `--legacy`'de
eski kuralla koşar; koşucu "GEÇERSİZ DENETİM" satırında senaryo başına sayısını yazar (2.4.4 kural setinin yazıp 2.4.5'in yazmadığı anahtarlar)]:
- `/2` `kontrol {raporlar: true}` (b3b, b3c, b3k, b3n, b3o, b3q, b3r, b3s, b3t, b3u, b3v, b3w, b3x, b3y): `kalem:<no>`, `kalemVar:<no>`, `kalemSoz:<no>`, `acilis:<no>` ("önce cari açın"
  Açılış Bakiyesi = takvim kaleminin `debt`'i), `k4:takvim`, `takvim:cokSekmeNotu` (takvim; madde 3/4).
- Bütün senaryolar: B4 (MM6) `nakit:kasaGiris/Cikis` (Tablodaki Nakit Akışı `cashIn/cashOut`) ve B5b (K5) `yetkisiz:<ad>:kasa`, `yetkisiz:<ad>:not`.
- Yeni (her `raporlar` kontrolünde): `takvim:tabloTutarli`, `takvim:kalemTutar:<no>`, `vadeTakip:tablo`, `projeksiyon:tablo`, `projeksiyon:tabloSecenek` = 0 [KULLANICI madde 4].
- DEĞİŞMEYEN: `k4:kisiler`, `k4:vade`, `k4:akis` (Tablodaki Kişiler / Vadeler / Nakit Akışı tablo raporlarıdır — madde 5 bu sürümde YALNIZ etiketler), `rapor:*`.
- Yerlerine 2.4.5 denetimleri: madde 4 `takvim:tabloTutarli`, `takvim:kalemTutar:<no>`, `vadeTakip:tablo`, `projeksiyon:tablo/tabloSecenek` = 0 [KULLANICI]; KS4 [BAŞ MİMAR]
  `nakit:kasaSutunu` = **"yok"** (Kasa sütunları KALKAR; mutant 107) ve Kasa yetkisi kaldırılmış kullanıcıda `yetkisiz:<ad>:kasaNotu` = **false** (not da kalkar; mutant 108).
  Kasa raporu (`kasaRapor:*`, MM6 kaynakları) aynen denetlenir.
- `BILINEN.json`: b3y'nin dört kaydı (`k1:acilis:2026/1012`, `k1:acilis:2026/1013`, `k1:kalem:2026/1013`, `k1:k4:takvim`) `"kural": "2.4.4"` — yalnız `--legacy`'de uygulanır.
- Mutasyon kümesi: geçersiz senaryolar 2.4.4 kipinde, öbür `/1 /2` senaryoları İKİ kipte, `/3` 2.4.5 kipinde değerlendirilir. 2.4.5'te konusu kalkan kuralların mutantları
  (1–5, 22, 38–50, 55, 56) yalnız 2.4.4 değerlendirmesinde yakalanır (koşucu "[2.4.4]" diye yazar).

### C1 Kayıt tahsilatı kapısı (madde 1)
- **C1.1** [BAŞ MİMAR K1 + KULLANICI KARAR ~21:35 UTC (1) "yeni giriş/düzeltme kapalı"] `config.legacyCasePayments` KAPALIYKEN `POST /api/workspace/cases/:key/payments` →
  **410**, gövde `code: "case-payments-closed"`, `error: "Kayıt tahsilatı kapatıldı; tahsilat Cari'den girilir."`; hiçbir satır yazılmaz (Kasa, mizan, Tablodaki Kişiler tahsilatı aynı).
- **C1.2** [KULLANICI "düzeltme kapalı" + K1 kodu] eski kayıt tahsilatının düzeltmesi `PUT /api/workspace/payments/:id` (testlerin düzeltme ucu) → 410 + aynı `code` ve `error`.
  [BAŞ MİMAR KS1] kayıt tahsilatını yaratan ya da değiştiren HER uç 410 `case-payments-closed`; K1 metnindeki `PUT /api/workspace/cases/:key/payments` 2.4.4'te yok (405) →
  ret, http ÇATAL `[404, 405, 410]` ("405/404 kalabilir").
- **C1.3** [KULLANICI "silme/geri yükleme açık"] `DELETE /api/workspace/payments/:id` AÇIK: Kasa ve Tablodaki Kişiler tahsilatı düşer; Silinenler'den geri yükleme AÇIK: geri gelir.
- **C1.4** [BAŞ MİMAR madde 1 "eski satırlar Kasa'da ve defterde (A 602) aynen"] `/3`'te kayıt tahsilatı (nakit) **B 100 / A 602**; mizan denetlenir (`/1 /2`'de denetlenmiyordu).
- **C1.5** Anahtar AÇIKKEN (senaryo `anahtar: {legacyCasePayments: true}` ya da `--legacy`) 2.4.4 davranışı (B1.8, N6). Koşucu `startTestServer`'a `legacyCasePayments`,
  `legacyTableTransfer` ve `legacyTableDues`'u (K4.1) HER ZAMAN açıkça verir, false dahil — [BAŞ MİMAR K1.2] test yardımcısı seçenek verilmezse eski testler için üçünü AÇAR;
  ürün varsayılanı KAPALI.
- Senaryo `c1-kayit-tahsilat-kapisi`; mutantlar 91 (kapı yok), 92 (silme kapalı), 93 (geri yükleme Kasa'ya dönmez), 105 (düzeltme açık).

### C2 Tablodan Aktar kapısı (madde 2)
- **C2.1** [BAŞ MİMAR K1 "aynı düzen" + KULLANICI (2)] `config.legacyTableTransfer` KAPALIYKEN `POST /api/workspace/plans/from-table` → **410** `code: "table-transfer-closed"`
  (ileti kararda yok — denetlenmez); kart açılmaz, tahsilat karta taşınmaz, cari bakiyesi aynı.
- **C2.2** [KULLANICI "Geri Al açık"] anahtar açıkken yapılmış aktarımın `POST /plans/imports/:id/undo`'su anahtar kapalı programda AÇIK: kart kalkar, taşınan tahsilat taksit dışına döner (B1.6).
  Nasıl denendi: senaryo anahtar AÇIK sunucuda başlar, aktarım yapılır, `sunucu_yeniden {anahtar: {}}` ile aynı veri klasöründe anahtarlar kapalı açılır, sonra Geri Al.
- Senaryo `c2-tablodan-aktar-kapisi` (Burak'ın aktarımı 410; Ayşe geri alındıktan sonra yeniden aktarım 410); mutantlar 94, 95.

### C4 Uyarı kapısı (madde 4)
- **C4.1** [KULLANICI KARAR ~21:35 UTC (4) + madde 4] `/dues` `items`'ta tablodan TUTARLI kalem YOK — ödeme günü (tutarlı tarih sütunu), aidat, ödeme sözü; carisi olan kaydınki de
  (`takvim:tabloTutarli` = 0: kimliği `due|…` ya da kaynak alanı boş / table / promise ve tutarı > 0 kalem sayısı; `takvim:kalemTutar:<no>` = 0).
- **C4.2** [KULLANICI ~21:25 UTC "kalacaklarda önerin uygun"] tablonun TUTARSIZ tarih hatırlatmaları KALIR: `deadlines`'ta kayıt başına sütun listesi = tablodaki "Duruşma Tarihi",
  "Sözleşme Bitiş", "İcra Son Tarihi" hücrelerinden tarihi bugün..bugün+6 olanlar (deadlines ufku KS5'in konusu değil — denetlenmez); [BAŞ MİMAR KS6] "Son Ödeme", söz tarihi gibi
  tutarlı kalem doğuran ödeme tarihi sütunları `deadlines`'a DÜŞMEZ (para tarihi ajandaya dönüşmez).
- **C4.3** Anlık Durum Vade Takip (`overview/vade-takip?preset=open`): kaynak table / promise (ya da kayıt bağlı, deadline olmayan) satır 0; deadline satırları C4.2 listesiyle aynı.
- **C4.4** Nakit Akış Projeksiyonu (`overview/nakit-akisi?from=bugün&to=+30&overdue=1`): tablo satırı 0; "Tablo" seçeneği kalkar → `&table=1` ile de 0.
- **C4.5** [YAYGIN — "taksit, çek, fatura … aynen"] fatura kalemi `invoice|<id>`: açık > 0 ise `{amount = açık, direction}` (satış in, alış out), değilse yok; portföydeki alınan
  çek `{amount, direction: in}` (yalnız `kontrol {uyari: true}`). Vade = belge tarihi (carinin vade günü 0).
- Senaryo `c4-uyari-kapisi`; `/2` `raporlar` senaryoları C0 ile; mutantlar 96, 97, 98.

### C6 Cari borç vadesi (madde 6)
- **S1** [KULLANICI (5 dk yetkisi, öneri EVET) + BAŞ MİMAR; PLAN §8.10, §4.3/2] Carinin ALACAK tarafı tek kuyruk: taksitsiz satış faturası, elle **Borç**, borç yönlü **Açılış**;
  BORÇ tarafı simetrik: alış faturası, elle **Alacak**, alacak yönlü Açılış. Sıra: kayıt tarihi, aynı tarihte yazım sırası (Vade / Beklenen Ödeme Tarihi sırayı DEĞİŞTİRMEZ). Bağlı
  ödemeler (faturaya bağlı tahsilat / ödeme / evrak, faturanın kendi evrakı) yalnız kendi kalemini kapatır ([AJAN B2.1] fazlası havuza); bağsız ödemeler (tahsilat / ödeme, çek/senet,
  iade artanı, [YAYGIN] tedarikçiye ciro edilen evrak) en eskiden dağıtılır; karşılıksız evrak kapatmaz (B2.2). Elle kaydın **Kalan**'ı = tutar − dağıtılan; Kalan > 0 → açık.
  Faturaların kapaması aynı kuyruktan (elle kayıt yokken `/1–/2` B2.1 ile bayt bayt aynı — bütün eski senaryolarda doğrulandı). Cari bakiyesi ve yevmiye DEĞİŞMEZ.
  Taksit kartlı caride Kalan tanımsız (denetlenmez). [BAŞ MİMAR KS2] müşterideki elle **Alacak** HARFİYEN S1: karşı taraf yükümlülüğü ("Ödenecek Borç" kalemi, vadesi
  varsa), müşterinin borcuna mahsup EDİLMEZ (2.0.17 "elle yazılan Alacak ödeme değildir"; karşılıklı kapama yalnız açık "Mahsup Et" ile); bakiye zaten net.
- **K6.1** [BAŞ MİMAR] `dueDate` (Vade Tarihi), `expectedDate` (Beklenen Ödeme Tarihi), `YYYY-AA-GG`, boş = yok; elle Borç / Alacak (`POST/PUT …/entries`, kind debt / credit) ve
  Açılış (`openingDueDate`, `openingExpectedDate`). Kaydın tarihinden ÖNCE → **400** + `field`; biçimsiz (13. ay, 30 Şubat, gg.aa.yyyy) → 400; hiçbir satır yazılmaz; eşit tarih
  geçerli. Düzenle'de yeni durum denetlenir (vadeyi tarihten öne alma; tarihi vadeden sonraya alma → 400). `field` değeri [YAYGIN] gövde anahtarının adı (`dueDate`, `expectedDate`,
  `openingDueDate`, `openingExpectedDate`). Tahsilat / ödeme (in / out) alan TAŞIMAZ: gönderilirse kaydedilmez (hareketin alanı boş ya da yanıtta yok — ÇATAL).
- **K6.2** [BAŞ MİMAR] `GET /api/workspace/accounts/:id` `entries[]`: elle Borç / Alacak ve Açılış satırında `dueDate`, `expectedDate` (boş = "") ve `remaining` (Kalan; [KS3] TL,
  `amount` ile AYNI birim, 2 ondalık — kuruş tamsayı DEĞİL). Alan yoksa "alan yok" (fark).
- **K6.3** [BAŞ MİMAR] `/dues` `items`: Kalan > 0 VE Vade ya da Beklenen Ödeme Tarihi'li elle kayıt / açılış → `{id "account|<entryId>", source "account", accountId, entryId,
  direction (in: carinin borcu / out: carinin alacağı), person = cari adı, label "Tahsil Edilecek Borç" / "Ödenecek Borç" (+ " (Ödeme Sözü)" Beklenen varsa), dueDate =
  Beklenen varsa o yoksa Vade, amount = Kalan, days, state overdue / today / upcoming}`; ufuk [KS5] geçmişin tamamı + bugün + 7 gün DAHİL (`days <= 7`;
  bugün+7 kalem VAR, bugün+8 YOK — c6 b6 / b7; rastgele üretici sınır gününü de üretir). Yalnız `accounts.view` yetkisi olana (yetkisi kaldırılmış kullanıcıda 0; kurulum denetimi: o kullanıcıya Cari listesi 403 olmalı). "Ödendi Say" YOK
  (`settle {id: "account|…"}` ret, kalem durur). Vade Takip (Anlık Durum) aynı kalemleri `{amount, date, direction}` gösterir (bugün+6'ya kadar denetlenir). Nakit Akış
  Projeksiyonu cari vadesini KATMAZ (satır 0; BİLİNEN SINIR 2.5.x). Silinen kayıt kalem değildir; Kalan 0 / tarihsiz kayıt kalem değildir.
- **K6.5** [BAŞ MİMAR, 24.10.2026, cari-vade soruları] (a) "Carinin Mevcut Borcu" kartının kapsadığı borçta `remaining` kapsanan kısmı İÇERİR (defter kalanı, faturanın `open`'ı gibi);
  takvim / zil / Vade Takip `amount` = Kalan − kartın açık kapsamı (kapsanan borç kartın taksitleriyle BİR kez; v2.0.23 kuralı). Kâhin: kartların hepsi mevcut borç kartı, carinin
  tek etkin elle kaydı / açılışı (borç yönlü) ve faturasız caride; açık kapsam = kart tutarı − kartın ödenen kısmı; [YAYGIN — PLAN §4.3/2 1b] kartın ödemesi defter Kalan'ını da
  düşürür (Kalan etiketi o durumda YAYGIN; kalem tutarı kart ödemesinden bağımsız — BAŞ MİMAR). Öbür kartlı durumlar tanımsız. Senaryo `c6c-mevcut-borc-karti`; mutantlar 112, 113.
  (b) Kapanmış dönemdeki (kayıt tarihi ≤ `lockedUntil`) kaydın vade alanları kilitli — Düzenle ret, alanlar aynı; dönemden sonraki kayıt düzenlenir (c6b ed1 / ed2; mutant 111).
  (c) Beklenen Ödeme Tarihi Vade Tarihi'nden ÖNCE olabilir — 400 DEĞİL (c6b v9; mutant 109). (d) Açılış satırı yokken `openingDueDate` / `openingExpectedDate` → 400
  `code: "opening-missing"`, cari açılmaz (c6b cq; mutant 110).
- **KS7** [BAŞ MİMAR, 24.10.2026, dar kontrol D1; dayanak önceden yazılmış metin: S1 "bağsız ödemeler (… iade) en eskiden dağıtılır", PLAN §3.11b/3 "değersiz yazılınca cari bakiyesi o
  tutar kadar kapanır", §3.11b/2 şüpheliye alma bakiyeyi değiştirmez] (a) faturasız stok **Satış İadesi** (müşteride alacak satırı; stok girişi `reason: "return"`, Cari Hesap) = BAĞSIZ
  ödeme: en eskiden kapatır (faturalar + elle Borç + Açılış, tek kuyruk); simetriği AÇIK alış iadesi nedenli (`reason: "preturn"`) faturasız stok çıkışı borç tarafında bağsız
  ödeme (formda yolu yok — BİLİNEN SINIR; kural modelde, senaryoda yok). **KS7.1** [BAŞ MİMAR, ajan sorusu; dayanak önceden yazılmış 2.0.17 kuralı "borç tarafında ödeme: ödeme,
  verilen çek/senet (ciro dahil), alıştan iade; SATIŞ faturası, elle Borç, STOKTAN SATIŞ ödeme değildir" + KS2]: stok formundan tedarikçiye nedensiz açık hesap çıkışı
  ("Stok satışı") alış iadesi DEĞİLDİR — carinin alacak tarafı kuyruğunda YÜKÜMLÜLÜK (tedarikçi borçlanır), bağsız ödeme sayılmaz. Önceki yorumum (yoklama 5'teki satırı
  alış iadesi sayıp YAYGIN etiketlemek) bu metinle düzeltildi (ders 40: netleştirme önceden yazılmış kuraldan); işlem `stok_satis_hesap {cari, tutar}`. (b) **Değersiz Alacak Yaz** satırı = bağsız kapatıcı (en eskiden); **Şüpheli Alacağa Al** kapatıcı DEĞİL (bakiye değişmez; 2.4.4'te cari hareketi
  yazmıyor). (c) elle Alacak / Borç KS2 gereği yükümlülük KALIR. (d) faturalara da uygulanır — değersiz yazılmış / stoktan iade alınmış carinin faturası açık görünmez; Kasa,
  yevmiye, bakiye DEĞİŞMEZ (stok iadesi / değersiz olan senaryoda mizan denetlenmez — 610 / 153 / 659 / 128 karşılıkları kâhinde yok). Yeni işlemler `stok_iade {cari, tutar}`,
  `alis_iade {cari, tutar}` (preturn), `stok_satis_hesap {cari, tutar}` (KS7.1), `supheli_al {ad, cari, tutar}` (tutar ≤ borç bakiyesi), `degersiz {supheli, tutar}` (≤ kaydın kalanı, tarihi kayıttan önce değil); uçlar
  `POST /api/workspace/stock/:id/moves`, `POST /api/workspace/accounts/:id/doubtful` (→ `record.id`), `POST …/doubtful/:id/write-off` (test çağrı satırları + yoklama 5; grep
  sırasında birkaç doğrulama satırı da göründü — yalnız gövde biçimi alındı, kural türetilmedi). Senaryo `c7-ks7-bagsiz-kapaticilar` (Açılış 1.000 / fatura 800 / Borç 500:
  satış iadesi 600 → Açılış 400; şüpheli 900 → değişmez; değersiz 900 → Açılış 0, fatura 300; tahsilat 300 → fatura 0; S: alış 400 + Alacak 300, KS7.1 nedensiz stok çıkışı 450 →
  fatura 400 ve Alacak 300 AÇIK, bakiye −250); rastgele üretici `stok_iade`, `stok_satis_hesap` (tedarikçiye), `supheli_al` + aynı gün tamamı `degersiz` (kayıt kapanır — açık kayıt sınırı `doubtful-normal-exceeds` dışında).
  Mutantlar 114 (satış iadesi kapatmaz — D1 eski hata sınıfı), 115 (değersiz kapatmaz — D1), 116 (şüpheliye alma da kapatır), 118 (KS7.1: nedensiz stok çıkışı alış iadesi sayılır);
  117 (preturn alış iadesi kapatmaz) KS7.1 ile kaldırıldı — senaryosu yok (formda yol yok).
- **ŞÜPHELİ KALAN** [PLAN §3.11b/2 (a)–(c), §3.11b/3; `docs/2.3.0-SUPHELI-KABUL.md` K1, K3, K7 — kod yazılmadan yazılmış kâhin belgesi (ders 40); Uzun Doğrulama #640 bulgusu, 25.10.2026]:
  şüpheli kaydın KALANI = alınan − şüpheliden düşen alacak satırları − değersiz. Kayıt tarihinden sonra (AYNI GÜN DAHİL — "aynı günde alınan kayda o günün tahsilatı düşer") gelen
  alacak satırı (serbest tahsilat, alınan evrak, elle Alacak, iade faturası, satış iadesi, taksit tahsilatı) önce şüpheliden düşer, en eski kayıttan; faturaya bağlı tahsilat
  ((b) "Kapatılacak Fatura") KENDİLİĞİNDEN normal (düşmez); kayıt tarihinden ÖNCE tarihli satır düşmez (sonradan girilse de); aynı gün sırası al → değersiz → alacak satırı.
  Değersiz Alacak Yaz tutarı ≤ girildiği andaki kalan (K7) — aşarsa ret `doubtful-writeoff-exceeds`, kalan 0 ise ret `doubtful-closed` (yalnız `code` denetlenir; etiket PLAN);
  Şüpheli Alacağa Al tutarı ≤ cari borç bakiyesi − açık kayıtların kalanı (K1). Önceki kâhin şüpheliyi "kalan = alınan − değersiz" sayıyordu ve üretici aynı gün tahsilatı
  olan carilerde tamamını değersiz yazdırıyordu (kâhin hatası — UD #640'ta 9 tohumda ilk fark). Üretici artık değersiz tutarını kâhinin kalanıyla sınırlar, %20 olasılıkla
  önce bilerek aşan adım (ret), kalan 0'da adım (ret) üretir; kayıt her durumda kapanır. Senaryo `c7b-supheli-kalan` (kayıttan önce 300 düşmez; aynı gün 400 düşer → kalan
  1.600; bağlı 500 düşmez; sonradan girilen önceki tarihli 200 düşmez; 1.700 ret aşan; 1.600 ok; 1 ret kapalı; ikinci kayıt 500 + aynı gün 600 → 100 ret kapalı).
  Mutantlar 119 (tahsilat düşmez), 120 (önceki tarihli satır da düşer), 121 (bağlı tahsilat da düşer). DENENMEYEN: karşılık / Şüpheliden Çıkar, açık kayıtla bağlı tahsilat
  sınırı (`doubtful-normal-exceeds` — üretici kaydı hep kapatır), taksit kartlı (c) yolu, karşılıksız dönen evrakın şüpheliye etkisi.
- **K6.4** [BAŞ MİMAR] Düzenle verilmeyen alanı korur (kısmi PUT); Silinenler'den geri yükleme ve yedekten geri yükleme Vade / Beklenen Ödeme Tarihi'ni TAŞIR; vade değişikliği
  yevmiyeyi değiştirmez (`kontrol {mizanKarsilastir: "<önceki kontrol>"}` → `mizanEsit` true). Göç (eski satırlar boş) kara kutudan DENENMEDİ (v2.4.4 verisi gerekir — C12).
- Senaryolar `c6-cari-vade-fifo` (elle elle hesaplanan beklenenler: k1 Kalan b1 300 / F1 800, k2 b1 0 / F1 0 / b2 300, k3 Açılış 400 / b1 500 / F1 300, k6 çekle b2 100, k7 karşılıksızla 300,
  k8 Vade gönderilen tahsilatla 200, k10 b2 silinince b3 100; S: Açılış 0, F2 250, a1 250 "Ödenecek Borç"), `c6b-cari-vade-dogrulama`, rastgele `rastgele-s1-<t>` (uretici.py --tur s1).

### C9 Dil `/3` ekleri
Üst düzey `anahtar {legacyCasePayments, legacyTableTransfer}` (verilmeyen KAPALI). Yeni adımlar: `sunucu_yeniden {anahtar}` · `alacak {cari, tutar, tarih, vade?, beklenen?}` ·
`borc {…, vade?, beklenen?}` · `odeme {cari, tutar, tarih, fatura?}` · `tahsilat {…, vade?}` (kaydedilmez) · `cari_ac {…, acilisYon: "alacak", acilisVade?, acilisBeklenen?}` ·
`hareket_sil {hareket}` · `hareket_geri_yukle {hareket}` · `hareket_duzenle {hareket, tutar?, tarih?, vade?, beklenen?}` (kısmi) · `cari_kalem_odendi {hareket}` ·
`kayit_tahsilat_duzenle {odeme, tutar}` · `kayit_tahsilat_put {kayit, tutar}` · `kayit_tahsilat_sil {odeme}` · `kayit_tahsilat_geri_yukle {odeme}` · `yedek_al {ad}` ·
`yedek_geri_yukle {yedek}` · `donem_kilitle {tarih}` (boş = aç) · `kullanici_ac {…, kaldir: ["accounts.view"]}` · `kontrol {uyari: true, mizanKarsilastir}`; `anahtar` ve
`sunucu_yeniden.anahtar` alanı `legacyTableDues`'u da alır. Hareket adı: adım id'si; Açılış `acilis:<cari>`.
Yeni çıktı anahtarları: `adim:<id>:{kod, ileti, alan}`, `<k>:hareket:<ad>:{var, kalan, vade, beklenen}`, `<k>:takvim:{hareket:<ad>, cariKalemSayisi, fatura:<ad>, cek:<ad>,
tabloTutarli, kalemTutar:<no>, deadline:<no>}`, `<k>:vadeTakip:{hareket:<ad>, tablo, deadline:<no>}`, `<k>:projeksiyon:{cari, tablo, tabloSecenek}`,
`<k>:yetkisizTakvim:<kullanıcı>:cariKalem`, `<k>:mizanEsit`, `<k>:mizan:602`, `<k>:nakit:kasaSutunu`, `<k>:yetkisiz:<ad>:kasaNotu`.

### C8 Nasıl bozulur? (2.4.5 — önce yazıldı; senaryo karşılıkları)
| # | Bozulma | Senaryo |
|---|---|---|
| Z1 | Kapı yalnız arayüzde kapanır, uç 200 döner; düzeltme (PUT /payments/:id) açık kalır; silme de kapanır (eski veri düzeltilemez) | c1 |
| Z2 | Anahtar yardımcıda varsayılan açık kalır (kâhin açıkça false verir) / yeniden açılışta anahtar kaybolur | c1, c2 (`sunucu_yeniden`) |
| Z3 | Geri yükleme Kasa'yı / A 602'yi geri getirmez; silme Tablodaki Kişiler'den düşmez | c1 |
| Z4 | Tablodan Aktar düğmesi kalkar ama uç yazar; Geri Al da kapanır | c2 |
| Z5 | Takvim'den tablo kalemi kalkar ama Vade Takip / Projeksiyon'da (ya da "Tablo" seçeneğinde, carili kayıtta, söz sekmesinde) kalır; duruşma / sözleşme bitiş de kalkar | c4, b3b…b3y |
| Z6 | FIFO: açılış kuyruğa girmez, vadeye göre dizilir, aynı gün ters sıra, bağlı ödeme havuza gider, silinen tahsilat kuyrukta kalır, karşılıksız kapatır | c6, rastgele-s1 |
| Z7 | Kalem tutarı Kalan değil tutar; Beklenen'e kaymaz; etiket eki yok; ufuk yok; Kalan 0 da kalem; yön ters; Beklenen tek başına kalem açmaz | c6, c6b, rastgele-s1 |
| Z8 | Yetkisiz kullanıcı görür; "Ödendi Say" kabul edilir; Projeksiyon katar | c6 |
| Z9 | Vade tarihten önce / biçimsiz kabul; tahsilat vadeyi kaydeder; Düzenle vadeyi siler; yedek / Silinenler vadeyi yitirir; vade değişikliği yevmiyeye girer | c6, c6b, rastgele-s1 |
| Z10 | Rastgele sıra (ders 17): fatura + elle kayıt + tahsilat + silme / geri yükleme + düzenleme karışık | rastgele-s1-<t> |

### C10 Mutasyonlar (2.4.5)
73–121 (`model.py --mutasyonlar`; 106–108 KS4/KS5'ten, 109–113 K6.5'ten, 114–116 KS7'den, 118 KS7.1'den, 119–121 şüpheli kalandan; 79 ve 117 yok — karşılıksızın kapatması eski mutant 7'de, artık elle kayda da uygulanır). Her biri en az bir senaryoda kâhin çıktısını değiştirir
(model tek başına doğrulandı: yakalanmayan 0). Koşucu mutantları tek Python sürecinde tarar (`model.py - --mutasyon-tara <liste>`; her mutantta ilk 3 yakalayan) —
eski "her mutant × her dosya ayrı süreç" yolu ~20 dk sürüyordu, yeni yol ~10 sn. Elle senaryolar önce taranır (çoğu mutantı onlar yakalar; 25.10.2026). Mutant modeli
çökertirse (ör. açılışı reddedilen cariye şüpheli kaydı) o dosyada YAKALANDI sayılır — davranış zaten değişmiştir; mutasyonsuz taban koşusu sarmalın dışındadır, çökerse
koşu durur (25.10.2026: Uzun Doğrulama #640 koşusunda tarama böyle çöktü; `supheli_al` artık cari yoksa ret verir, kanıt `docs/kanit/2026-10-25/245-kahin-ud/`).

### C11 SORU → KARARA BAĞLANDI (BAŞ MİMAR KARARI KS1–KS6, 24.10.2026 ~17:30 UTC, `docs/2.4.5-IS-LISTESI.md` "KÂHİN SORULARI"; kâhine işlendi)
KS1 → C1.2 (her yaratan / değiştiren uç 410; `PUT /cases/:key/payments` 405/404 kalabilir) · KS2 → S1 (müşteride elle Alacak harfiyen, etiket YORUM → BAŞ MİMAR) · KS3 → K6.2
(`remaining` TL) · KS4 → C0 (Tablodaki Nakit Akışı'nda Kasa sütunu ve yetkisiz notu YOK; mutant 107, 108) · KS5 → K6.3 (bugün+7 DAHİL; mutant 106) · KS6 → C4.2.
Sorulan metin (kayıt için aynen):
1. K1 "POST ve PUT `/cases/:key/payments`": PUT bu yolda 2.4.4'te yok (405); gerçek düzeltme ucu `PUT /api/workspace/payments/:id`. Kâhin: ikincisi 410 + kod [KULLANICI "düzeltme
   kapalı"], birincisi ret ÇATAL [405, 410]. Kod iki yolu da kapatmalı mı?
2. S1 "tarafa göre" iki kuyruk: müşteride elle **Alacak** (ör. iskonto / iade dekontu) harfiyen borç tarafı kalemidir ("Ödenecek Borç", müşteri borçlarını kapatmaz). Yaygın açık
   kalem eşleştirmesi (Logo / Mikro) aynı caride borç ve alacağı birbirine kapatır. Kâhin harfiyen okur, etiket YORUM (İNCELE) — hangisi?
3. K6.2 `remaining` "(Kalan, kuruşla)": kâhin `amount` ile aynı birimde (TL, kuruş hassasiyetinde) okur; tamsayı kuruş verilirse 100 kat fark çıkar. Birim?
4. Madde 5 "Kasa sütunları Tablodaki Nakit Akışı'nda kalmaz (öneri; ek madde değilse yalnız etiket)": kâhin ÇATAL (Kasa raporu ya da alan yok). Kalkarsa K5'in "yetkisiz kullanıcıya
   Kasa gizli + not" denetimi (`yetkisiz:<ad>:not`) anlamsızlaşır — değişmeden mi kalsın?
5. K6.3 ufku "bugünden 7 gün": bugün+7 dahil mi? Kâhin sınır gününü denetlemez (rastgele üretici o günü üretmez).
6. Madde 4: tablonun tarihli ama tutarsız sütunları (ör. yalnız "Son Ödeme" + tutar yok) `deadlines`'a mı düşer? Kâhin yalnız kullanıcının saydığı üç başlığı (Duruşma Tarihi,
   Sözleşme Bitiş, İcra Son Tarihi) denetler; "Son Ödeme" / söz tarihi `deadlines`'ta OLMAMALI der.

### C12 DENENMEYEN (neden)
- Kayıt kartındaki Tahsilat düğmesinin HTML'den kalkması, "önce cari açın" formunda Açılış Bakiyesi'nin ve zil / takvim "Tahsilat Gir"in tutarının boş gelmesi (madde 3 — arayüz;
  kâhin yalnız vekili denetler: takvimde tablo kalemi / `debt` yok), pil kartı düğmeleri (6a).
- Silinenler'den geri yüklenen kayıt tahsilatının Tablodaki Kişiler'e dönüşü yalnız aynı tablo yüklüyken; tablo değişince (Yerine koy) eski tahsilatın yeri B3f kuralına bağlı → geçersiz.
- K6.4 göçü (v2.4.4 verisiyle açılan 2.4.5'te eski satırların boş alanları): kâhin TEK program kökünü koşar; v2.4.4 gerçek koduyla veri üreten göç takımının (madde 30) işi.
- Excel'den cari yükleme (vade sütunu yok — madde 6); Açılış'ın sonradan Düzenle ile vadelenmesi (`PUT /accounts/:id` gövdesi kara kutudan bilinmiyor); taksit kartlı caride Kalan;
  tedarikçiye ciro edilen evrakın borç tarafı dağıtımı (rastgele üreticide yok); 002 şirketi; Sheets eşitlemesi.

## 9. 2.4.6 kuralları — kural seti `2.4.6` (25.10.2026, 2.4.6 madde 0 "kâhin önce"; dil `/3` aynı)

### C00b Temiz oda (2.4.6)
- **Okunan kaynaklar (karar metinleri):** `docs/2.4.6-IS-LISTESI.md` madde 9, 10, 11 (+ Amaç, çalışma düzeni); `docs/2.4.5-IS-LISTESI.md` "BAŞ MİMAR KARARLARI" (S1, K6.1–K6.5,
  KS1–KS7), DAR KONTROL (D1, KS7), ADAY 2 (KS7.1, DB1, DB2); `docs/GECMIS-KARARLAR.md` 10.10.2026 "R1" ve "K1 İADE KAPANIŞI" satırları (DB1'deki "R1 düzeni"nin kaynağı);
  `test/bagimsiz/SENARYO-DILI.md` §4.14–§4.16 ve §7 (önceki temiz oda dilinin iade kuralları 2 ve 5; `kapatilacakFatura` satıştan iade); CLAUDE.md (anayasa, dersler 5/32/40,
  kalıcı karar "fatura kapama yöne göre"); bu klasörün önceki kâhin dosyaları.
- **Okunmayanlar:** `server/**`, `client/**`, `test/e2e/**`, `docs/kanit/**`, git farkları. Ürün kodunun 2.4.6 düzeltmeleri (başka ajanlarda) görülmedi.
- **İstek gövdeleri:** iadenin kendi geri ödemesi (`payment.cash[{amount, method, lineKey}]`) `test/bagimsiz/surucu.mjs` `iade` adımından (kâhin aracı). `preturn` için
  `test/*.test.mjs` yalnız İSTEK satırı arandı; grep çıktısında BİR doğrulama satırı göründü (`test/kapama-ks7-245.test.mjs:38`, `classifyLine` + `stockReason: "preturn"`) — kural
  türetilmedi (KS7 simetri 24.10'dan beri bu dosyada), yalnız 2.4.5'teki farkın yerini anlamada not edildi (aşağıda KS9).
- **Kara kutu yoklaması (yalnız ORTAM — alan adı / yanıt biçimi; kural türetilmedi; 2.4.5 kodu, not defteri `246-kahin-cari/yokla/yokla-proj.mjs`):** `GET /overview/nakit-akisi?…&overdue=1`
  → `{rows[], overdue[], …}`, satır `{date, direction, amount (TL), source, label, party, ref{type, id}}`; 2.4.5'te elle borç için `source: "unbilled"` "Faturasız Cari Alacağı"
  satırı VAR (kayıt tarihinde, `ref.id` = cari kimliği) → K-P2.

### KS8 — İade geri ödemesi (madde 9 / DB1) [BAŞ MİMAR]
- **Metin:** "faturasız stok Satış İadesi ya da fatura iadesi bedeli cari kartından 'Ödeme' ile müşteriye geri ödenince → 'iade geri ödemesi': geri ödeme iadeye bağlanır (R1 düzeni),
  müşteri carisinde iadeyi karşılayan ödeme borç tarafında ödeme SAYILMAZ; fatura + vadeli borç açığı iade kadar eksik görünmez (örnek: B 200 + borç 300 → doğru 500 + 300 = 800).
  Cari bakiye, Kasa, yevmiye DEĞİŞMEZ (yalnız kapama / hatırlatma)."
- **Kâhin:** müşteriye iade kalemi = fatura iadesi (tutar − kendi geri ödemesi) ve faturasız stok Satış İadesi. Bu kalem BORÇ tarafında "iade geri ödemesi" yükümlülüğüdür; yalnız cari
  "Ödeme" (bağsız, ya da Kapatılacak Fatura = o iade belgesi — K-d) kapatır → geri ödenen tutar G. ALACAK tarafında iadenin yalnız geri ödenmeyen kısmı (T − G) kapatıcıdır: fatura
  iadesinde §7 kural 5–6 (önce asıl faturanın açığı, artanı en eskiden), stok iadesinde KS7 (a) (bağsız kapatıcı, en eskiden). Geri ödeme önceliklidir: sonradan gelen Ödeme, asıl
  faturaya ya da en eski borca düşmüş iadeyi geri açar (örnekteki 200 → 500). Ödeme'nin iadeyi aşan kısmı borç tarafında bağsız ödemedir (öbür yükümlülükler / avans).
  Bakiye, Kasa değişmez (denetlenir); mizan bu senaryolarda denetlenmez (ödeme / stok satırları — §8 KS7 (d) gibi).
- **R1 düzeni (önceki karar):** iadenin KENDİ geri ödemesi (`iade {geri: "nakit"}`; iade belgesinin ödeme bölümü) iadeyi kapatır, asıl faturaya düşmez (K1 İADE KAPANIŞI). 2.4.5
  ve 2.4.6 kural setlerinde aynı; c8 C carisi — Ödeme yoluyla (B) aynı sonucu vermelidir.
- **Etiket:** caride iade + (Ödeme ya da kendi geri ödemesi) varsa sınıf; her iade TAMAMEN geri ödenmiş ya da bağsız Ödeme yok, kısmi yok, borç tarafı yükümlülüğü yok → BAŞ MİMAR
  (örnek sınıfı; fatura iadesinin "iade" AJAN nedeni düşer — iade kural 5–6'ya girmez); kısmi / bağsız Ödeme + geri ödenmemiş iade / borç tarafı yükümlülüğü → YAYGIN (K-a, K-b).

### KS9 — Faturasız Alış İadesi gerçek yol (madde 10) [BAŞ MİMAR] + simetrik geri tahsilat [YAYGIN — K-c]
- **Metin:** "stok formunda faturasız Alış İadesi ('preturn') — KS7.1 simetri kuralı gerçek yol olur" (madde 10; KS7 (a) "simetriği faturasız stok Alış İadesi (tedarikçide borç
  satırı) = bağsız ödeme"). Kâhinde kural 24.10'dan beri vardı, senaryosu yoktu ("formda yol yok"); 2.4.6'da c8 S / S2 ve rastgele s1 (`alis_iade`) kullanır. Mutant 117 geri geldi.
- **Simetri (K-c):** tedarikçinin iade bedelini cari "Tahsilat" ile geri ödemesi alış iadesine bağlanır (geri tahsil edilen kısım borç tarafında ödeme değildir); yalnız 2.4.6'da. Sıra §11: K-b +
  KS8.1 simetriği (bağsız Tahsilat önce alacak tarafı yükümlülükleri + açık alış iadesi notu, artanı kapatıcı alış iadesinin geri tahsilatı).
- **2.4.5 kodunda (değişmemiş program):** uç (`POST /stock/:id/moves {kind: out, reason: "preturn", pay: account}`) kabul ediyor, cari bakiyesi tutuyor, ama alış faturasını KAPATMIYOR
  (AS1 500 kalır) — 2.4.5'te bu yol yalnız birim düzeyindeydi (iş listesi "BİLİNEN SINIR"). Koşucu bu farkları "KS9 madde 10 yolu" sınıfında sayar (2.4.5 ↔ 2.4.6 kâhin beklentisi
  aynı olduğu için "değişen beklenti" sınıfına düşmezler).

### KS10 — Nakit Akış Projeksiyonu'nda cari vadeli kalemler (madde 11) [BAŞ MİMAR]
- **Metin:** "Nakit Akış Projeksiyonu'na cari vadeli borç kalemleri (madde 6'nın Vade / Beklenen Ödeme Tarihi; FIFO kalanı; aynı borç kartın taksitleriyle bir kez — K6.5 (1))."
- **Kâhin:** K6.3 kalemi projeksiyonda (`<k>:projeksiyon:hareket:<ad>` = `{amount, date, direction}` ya da "yok"): tarih = Beklenen Ödeme Tarihi varsa o, yoksa Vade Tarihi; tutar =
  FIFO Kalan − Mevcut Borç kartının açık kapsamı (takvimdeki tutar; K6.5 (1)); yön in / out (iki taraf); silinen / Kalan 0 / tarihsiz / pencere dışı → "yok". Pencere koşucunun isteği
  (bugün → bugün + 30, `overdue=1`); sınır günü ÇATAL, vadesi geçmiş kalem YAYGIN (K-P1). `<k>:projeksiyon:cari` = kalem sayısı. "Bir kez" (K-P2, YAYGIN): temiz caride (fatura / evrak
  / kart / kapatıcı / şüpheli / tablo kaydı yok, tek taraf, her açık kaydın tarihi pencerede, dağıtılmamış ödeme yok) `<k>:projeksiyon:cariToplam:<cari>` = carinin bütün projeksiyon
  satırlarının işaretli toplamı = bakiye (Faturasız Cari Alacağı + vadeli kalem çift sayılmaz). 2.4.5'te H carisinde bu toplam ZATEN tutar (unbilled 650) — denetim 2.4.6'nın çift
  sayımına karşı bekçidir.

### C0b 2.4.6 kararıyla GEÇERSİZ / DEĞİŞEN denetimler (silinmedi; `--kural 2.4.5`'te eski kuralla)
- `<k>:projeksiyon:cari` = 0 (K6.3 "Projeksiyon cari vadesini KATMAZ — BİLİNEN SINIR 2.5.x") → **2.4.6 kararıyla geçersiz**; yerine KS10 kalem sayısı. Mutant 99 ("katar") 2.4.6'da
  doğru davranıştır → yalnız 2.4.5 değerlendirmesinde yakalanır (koşucu "[2.4.5]" yazar); tersi mutant 122.
- Mevcut senaryolarda başka beklenen değer DEĞİŞMEDİ (41 elle + 6 s1 + 6 ux18 × 120 işlem: 2.4.6 ↔ 2.4.5 farkı yalnız `projeksiyon:hareket` (yeni), `projeksiyon:cari`, `projeksiyon:cariToplam`
  (yeni) ve alış faturası açığının açıklama metni). `--kural 2.4.5` ve `--legacy` çıktıları eski modelle (e77447a) 106 karşılaştırmada bayt bayt aynı.
- Koşucu her senaryoda "2.4.6 kararıyla değişen beklenti" (2.4.5 ↔ 2.4.6 kâhin çıktısı farkı) kümesini kurar ve programla her farkı sınıflar: değişen / KS9 madde 10 yolu / SINIF DIŞI.
  2.4.5 kodunda SINIF DIŞI fark 0 beklenir.

### C9b Dil ekleri (2.4.6)
`iade {…, geri: "nakit"}` (iadenin kendi geri ödemesi; Kasa'dan çıkar; gövde `payment.cash[{amount, method: "cash", lineKey: "g1"}]`, `cashForce`) · `odeme {cari: <müşteri>, fatura:
<iade adı>?}` (KS8) · `alis_iade` artık senaryolarda (KS9) · herhangi bir adımda `catal: true` (karar metni adımın kabulünü söylemiyor — kâhin iki dünya hesaplar: kabul ve adımsız;
farklı çıkan denetimler ÇATAL, etiket YAYGIN; adımın durumu ÇATAL ok / ret). Yeni çıktı anahtarları: `<k>:projeksiyon:hareket:<ad>`, `<k>:projeksiyon:cariToplam:<cari>`.

### C8b Nasıl bozulur? (2.4.6 — önce yazıldı; senaryo karşılıkları)
| # | Bozulma | Senaryo |
|---|---|---|
| Z11 | Müşteriye Ödeme borç tarafında ödeme sayılır, iade yine kapatır (DB1) — fatura ve vadeli borç eksik, takvim / Vade Takip / Projeksiyon eksik | c8 A, A2, B; rastgele s1 |
| Z12 | Fatura iadesinde geri ödeme yalnız stok iadesine uygulanır (FATURA iadesi asıl faturaya yine düşer) | c8 B |
| Z13 | Kısmi geri ödemede iadenin tamamı geri ödenmiş sayılır / fazlası iadeye yazılır | c8 D; rastgele s1 (kısmi / fazla) |
| Z14 | Ödeme silinince / geri yüklenince geri ödeme bağı kalır / dönmez | c8 A (k5, k6); rastgele s1 (hareket_sil) |
| Z15 | Bağlı Ödeme (Kapatılacak Fatura = iade) bağsız sayılır — yanlış iade geri ödenir | c8b |
| Z16 | Faturasız Alış İadesi alış faturasını kapatmaz; tedarikçinin geri tahsilatı alış iadesine bağlanmaz | c8 S, S2; rastgele s1 |
| Z17 | Projeksiyon cari kalemini katmaz / Kalan yerine tutar / Beklenen'e kaymaz / pencere dışını katar / gecikmişi atar / kartla çift / Faturasız Cari Alacağı ile çift | c10, c6, c6b, c6c |
| Z18 | Düzenle / sil / geri yükle sonrası projeksiyon eski kalemi taşır | c10 H (k3–k6) |

### C10b Mutasyonlar (2.4.6)
117 (KS9: Alış İadesi kapatmaz — geri geldi), 122–131, 133–136 (`model.py --mutasyonlar`); 99 yalnız 2.4.5 kipinde. Mutasyon taraması `/3` dosyalarını HER kipte iki kural setiyle
(2.4.6 + 2.4.5) değerlendirir. Model tek başına: 134 mutantın hepsi yakalandı (25.10.2026).

### C11b KARAR GEREKİR (ders 40 — metin susuyor; kâhin önerilen okumayı YAYGIN etiketle uygular, fark İNCELE)
- **K-a Kısmi / fazla geri ödeme:** Ödeme < geri ödenmemiş iade → yalnız ödenen kısım geri ödemedir, kalan iade kapatıcı kalır; Ödeme > iade → fazlası borç tarafında bağsız
  ödeme (avans). Öneri: böyle (QuickBooks / Xero kısmi "refund" — kalan kredi kullanılabilir; Logo / Mikro açık kalemde kısmi kapama). Mutant 131.
- **K-b Sıra:** bağsız Ödeme birden çok iade ve borç tarafı yükümlülüğü (elle Alacak, alış faturası) arasında → tek FIFO (kayıt tarihi + yazım sırası, S1 gibi; iade kalemi kendi
  tarihinde); Ödeme iadeden önce tarihli olsa da son durumdan dağıtılır. Öbür okuma: önce iade (mutant 133). Öneri: S1 FIFO (PLAN §8.10 "Otomatik (En Eski)") + formdaki bilgi notu.
- **K-c Simetri:** tedarikçiye Alış İadesi + tedarikçinin "Tahsilat" ile geri ödemesi → alış iadesine bağlanır (DB1'in ayna sınıfı; madde 10 yolu açınca ulaşılabilir olur). Öneri: evet
  (S1 "borç tarafı simetrik"; QuickBooks vendor credit refund, Xero supplier credit note refund). Mutant 135.
- **K-d Bağlı geri ödeme:** cari "Ödeme"de Kapatılacak Fatura = satıştan iade belgesi seçilebilir mi? 2.4.5 reddediyor ("Ödeme yalnız alış faturasını kapatır; satış faturası için
  Tahsilat girin"); faturasız stok iadesinde seçilecek belge yok. Kâhin ÇATAL (c8b). Öneri: kabul (SENARYO-DILI §4.16 + kalıcı karar "fatura kapama yöne göre": satıştan iade borç
  yönlü belgedir; Xero / QuickBooks refund doğrudan iade belgesine) — ya da bilerek yalnız otomatik bağ (o zaman 2.4.5 reddi kalır).
- **K-e Ödeme yolu:** iade bedeli ciro edilen çekle ya da havale / POS iadesiyle geri ödenirse? Kâhin yalnız cari "Ödeme"yi (kind out) geri ödeme sayar (metin "Ödeme ile"); ciro borç
  tarafı ödemesi kalır. Öneri: müşteriye yapılan her ödeme (yolu ne olursa olsun) — karar.
- **K-P1 Projeksiyon penceresi:** vadesi geçmiş cari kalemi "gecikenler dahil"de görünür (kâhin YAYGIN); pencere sonu günü (bugün + 30) dahil mi (kâhin ÇATAL). Öneri: fatura kalemiyle aynı.
- **K-P2 Çift sayım:** 2.4.5'teki "Faturasız Cari Alacağı" (unbilled) satırı ile vadeli kalem aynı borcu iki kez katabilir. Kâhin: temiz caride toplam = bakiye. Öneri: vadeli kaydın Kalan'ı
  yalnız vadeli kalem olarak; "Faturasız Cari Alacağı" vadesiz kalana iner (ya da kalkar).
- **K-P3 Yetki:** projeksiyondaki cari kalemleri yalnız `accounts.view` yetkisi olana mı (K6.3 takvim gibi)? Kâhin denemedi. Öneri: evet.
- **K-f Cari türü:** "müşteri carisinde" — kâhin türe bakmaz (tedarikçi / diğer türünde satış iadesi + Ödeme denenmedi).

### C12b DENENMEYEN (2.4.6; neden)
- Stok FORMUNDAN Alış İadesi (madde 10'un arayüzü — kâhin API düzeyinde; e2e işi); Ödeme formundaki bilgi notu; yevmiyenin 2.4.5 ↔ 2.4.6 aynılığı (kâhin bu senaryolarda mizanı
  denetlemez — öneri: c8'in `program.json` `k*:mizan:*` değerleri iki kodda karşılaştırılır); kısmi fatura iadesi (kâhinde iade tam); alış faturası iadesi (purchase_return) + tedarikçi
  geri tahsilatı; projeksiyon yetkisiz kullanıcı (K-P3); Mevcut Borç kartlı caride Ödeme / iade; şüpheli kayıtlı caride iade geri ödemesi; ciro ile geri ödeme (K-e).

### C13b 2.4.5 kodunda (değişmemiş program, bu dalın tabanı) sonuç — 25.10.2026, kâhin 3dfb1c7, kanıt `docs/kanit/2026-10-25/246-kahin-cari/`
- **2.4.6 kural seti (varsayılan çağrı: 36 senaryo + 2 tohum × 60):** 7.006 denetim, 408 fark — KS8 77, KS9 53, KS10 278; **SINIF DIŞI 0**; okuma hatası 0; 134 mutantın hepsi yakalandı.
  Ek rastgele s1 tohum 3–10 × 120: 15.583 denetim, 939 fark (KS8 328, KS9 112, KS10 499), SINIF DIŞI 0. Kırmızının nedeni iletide (ders 38): c8 A "FA1 program 200 · kâhin 500"
  (DB1 örneği aynen), A2 borç kalemi takvim / Vade Takip "100 · 400", B "FB2 0 · 200" (fatura iadesi + Ödeme), D kısmi; c10 / c6 projeksiyonda cari kalemi "yok"; tedarikçi T'nin
  projeksiyon toplamı 0 (2.4.5'te borç tarafı hiç yok); S / S2 Alış İadesi alış faturasını kapatmıyor (KS9 yolu).
- **2.4.5 kural seti (`--kural 2.4.5`):** 6.594 denetim, 76 fark — HEPSİ faturasız Alış İadesi olan tedarikçi carilerinde (73) + aynı kontrolün türev sayacı (3). Yani 2.4.5 kuralları
  2.4.5 koduyla bu yol dışında birebir; KS7 simetrisinin (preturn) 2.4.5'te uçta karşılığı yok — madde 10 tam bu.
- **Legacy (`--legacy`):** 183 fark — eski kâhinin (e77447a) aynı koşusuyla fark kümesi BAYT BAYT aynı (ayrık 0): 2.4.5'in bilerek kaldırdığı denetimler (B4 MM6 Kasa sütunu …).
- **Eşdeğerlik:** yeni `model.py --kural 2.4.5` / `--legacy` = eski model, 53 senaryo × 2 kip (106/106).
- **Gözlem (BULGU değil):** iadenin KENDİ geri ödemesi (R1, c8 C) 2.4.5'te doğru — FC2 200 açık; Ödeme yoluyla (B) 2.4.6'da aynı sonuç beklenir. E (elle Alacak + iade + Ödeme) 2.4.5'te
  kâhinin K-b önerisiyle aynı (Ödeme Alacak'ı kapatır). H'nin "bir kez" toplamı 2.4.5'te TUTUYOR (Faturasız Cari Alacağı 650) — 2.4.6'da vadeli kalem eklenip bu satır kalırsa
  1.300 okunur (K-P2'nin bekçisi). Bağlı Ödeme (c8b) 2.4.5'te 409 ret ("Ödeme yalnız alış faturasını kapatır; satış faturası için Tahsilat girin.") — ÇATAL'ın "ret" dünyası tuttu.

## 10. 2.4.6 karar revizyonu (25.10.2026 ~13:05–14:30 UTC) — KS8.1, KS8.2, KS8.3, K-a…K-f; S-a / S-b / sıra senaryoları

### C00c Kaynak (temiz oda)
- **Okunan:** ana çalışma kopyasının `docs/2.4.6-IS-LISTESI.md` "BAŞ MİMAR KARARLARI": KS8.1, KS8.2, KARAR REVİZYONU (KS8.3), "KARAR — 5 DK YETKİSİYLE UYGULANDI" (K-a…K-f, K-P1), DAR KONTROL 1
  B1–B5 bulgu cümleleri (yalnız beklenen sayılar: B1 "1.300, beklenen 1.000", B2 "F1a 0 ≠ 100, F1b 100 ≠ 200"), K9.1, K11.1–K11.2; `docs/2.4.5-IS-LISTESI.md` K6.5 (1); ana oturumun
  iletisi (S-a / S-b / sıra tarifleri). Mevcut Borç kartı isteği (`POST /plans {…, coversBalance: true}`) `test/*.test.mjs` İSTEK satırlarından. **Okunmayan:** `server/**`, `client/**`.

### Kurallar (önceki §9 okumalarının yerine)
- **KS8.1 [BAŞ MİMAR]** bağsız müşteriye Ödeme (tedarikçiden bağsız Tahsilat simetrisi) önce açık iade notlarını kapatır; not kalmazsa iadenin kapattığı fatura / borç YENİDEN AÇILIR
  (iadenin geri ödemesi, en eski önce); açık bağ (Kapatılacak Fatura = iade) önceliklidir. Değişmez Σ açık = bakiye. Kâhinde: iadenin geri ödenen kısmı kapatıcı değildir — geri ödeme
  arttıkça önce açık not, sonra kapatılan borç geri gelir (tek iadede KS8.1 ile aynı; birden çok iadede kâhin iade başına en eskiden yazar — kısmi geri ödemede YAYGIN). Mutant 137 (B2: yalnız
  açık not geri ödenir, kapatılan borç açılmaz).
- **KS8.2 [BAŞ MİMAR]** tarih koşulu YOK — iadeden önce tarihli Ödeme de geri ödemedir (mutant 141). Taksitli faturanın iadesine bağ 409 "refund-planned" (kâhinde iade taksitsiz asıl ister — DENENMEDİ).
- ~~**KS8.3 [BAŞ MİMAR]** iade varken bağsız para ÖNCE iadenin geri ödemesidir; fazlası carinin karşı taraftaki açıklarına (elle Alacak, alış faturası), ondan fazlası avans (K-a).~~
  **GERİ ALINDI (25.10 ~15:30 UTC, §11)** — K-c'nin yanlış okumasıydı; mutant 133 artık bu okumadır. c8 E beklentisi ilk hâline döndü (fatura 200, Alacak 0).
- **K-a / K-c / K-d / K-e / K-P1 [KULLANICI — 5 dk yetkisiyle]:** kısmi / fazla (yalnız ödenen kısım, fazlası avans); tedarikçi simetriği (alış iadesi + Tahsilat); Ödeme'de Kapatılacak Fatura =
  iade belgesi KABUL (c8b'deki ÇATAL kalktı; mutant 136); her ödeme yolu (nakit, havale, çek ciro) geri ödeme — kâhinde müşteriye ciro da (mutant 138), tedarikçiden alınan bağsız evrak da
  (simetri, YAYGIN); projeksiyon penceresinin son günü DAHİL (c10 bg4 ÇATAL kalktı; mutant 139). K-f: cari türüne bakılmaz (kâhin zaten bakmıyordu).
- **K6.5 (1) [BAŞ MİMAR, 2.4.5]** Mevcut Borç kartlı caride fatura kalemi takvim / Vade Takip / projeksiyonda NET (açık − kartın açık kapsamı); kapsanan borç kartın taksitleriyle BİR kez; faturanın
  `open`'ı kapsananı İÇERİR. Mutant 140 (B1: fatura kalemi brüt — 1.300 sınıfı).

### Dil ekleri
`fatura {…, adet}` (tek kalem, `adet` miktar) · `iade {…, adet}` (kısmi iade: tutar = asıl × adet / asıl adet) · `kart_ac {ad, cari, tutar, taksit, ilkVade, tarih, mevcut}` (Mevcut Borcu
Taksitlendir; taksitler eşit, ayda bir [YAYGIN]) · `kontrol {gorunumToplam, acikToplam}`: `<k>:takvim|vadeTakip|projeksiyon:cariToplam:<cari>` (carinin bütün satırları — ad, cari / hareket /
fatura / kart kimliği — işaretli toplamı; yalnız kâhinin bütün kalemlerini bildiği ve Σ kalem = bakiye olan caride), `<k>:vadeTakip|projeksiyon:fatura:<ad>`, kartlı caride `<k>:takvim:fatura:<ad>`;
`<k>:cari:<cari>:acikToplam` (Σ açık: fatura `open` satış +, alış / iade −; elle kayıt `remaining`) ve `acikEsitBakiye`. Pencereler: takvim geçmiş + bugün + 7; Vade Takip bugün + 6'ya kadar kesin,
sonrası ÇATAL; projeksiyon geçmiş + bugün + 30 (son gün dahil). API kartının taksit tarihi ± 4 gün kesin sayılmaz.

### Senaryolar (elle tablo ↔ kâhin: 105/105)
- **c11-ks81-sa-mevcut-borc-karti (S-a):** SA 1.000 → stok iadesi 300 (SA 700) → bağsız Ödeme 300 (SA 1.000) → kart 1.000 / 2 taksit: bakiye 1.000, SA açık 1.000, fatura kalemi her görünümde
  "yok", projeksiyon cari toplamı 1.000 [BAŞ MİMAR], takvim 500 [YAYGIN eşit taksit], Vade Takip {500, 1.000}.
- **c12-ks81-sb-kalan-dagilimi (S-b):** B1 Borç 200 + iade 500 + Ödeme 400 → Borç 100; B2 FB 1.000 (Tahsilat 600 bağlı) + iade 500 + Ödeme 300 → FB 200; B3 tedarikçi Alacak 200 + Alış İadesi 500
  + Tahsilat 400 → Alacak 100; B4 Borç 200 + Alacak 150 + iade 300 + Ödeme 500 → Borç 200, Alacak 0, avans 50 (Σ açık 200 ≠ bakiye 250).
- **c13-ks83-ayni-gun-sira:** aynı gün üç yazım sırası (Alacak/iade/Ödeme; Ödeme/iade/Alacak; iade/Ödeme/Alacak) → ~~hepsinde fatura 500, Alacak 300~~ (KS8.3 — geri alındı; §11: fatura 200,
  Alacak 0), bakiye 200; S4 Ödeme iadeden önce → yine geri ödeme; S5 müşteriye ciro (K-e).

### C13c Sonuç — aday246-2 bc1253c kodu (ayrı kopya; kâhin e83879a; kanıt `docs/kanit/2026-10-25/246-kahin-cari/aday2-bc1253c-e83879a.*`, `siniflama-aday2-e83879a.json`)
- 39 senaryo, 7.220 denetim, 135 fark — **sınıf dışı 0**, okuma hatası 0, 139 mutantın hepsi yakalandı. Farklar:
  c11 6 = dar kontrol **B1** (projeksiyon cari toplamı program 1.300 · kâhin 1.000; fatura kalemi her görünümde 300 · "yok"; takvim 800 · 500); c12 32 = **B2** (B1 Borç 0 · 100, B2 FB 100 · 200,
  B3 tedarikçi Alacak 0 · 100, B4 Borç 100 · 200; programda Σ açık ≠ bakiye); c13 26 + c8 E 32 + rastgele s1 tedarikçi S 39 = **KS8.3 / K-c** (bağsız para önce iade — bc1253c'den sonra
  karara bağlandı; programda Ödeme önce elle Alacak'ı kapatıyor: fatura 200 · 500, Alacak 0 · 300).
- **Tutanlar:** c8b (K-d bağlı Ödeme kabul), c10 (KS10, K-P1 son gün), c8'in A / A2 / B / C / D / S2 (KS8 DB1 düzeltmesi), c13 S4 (KS8.2 — iadeden önce tarihli Ödeme) ve S5 (K-e — müşteriye ciro).
- **Eski kodda kırmızı (ders 7):** yeni üç senaryo 2.4.5 kodunda 287 denetim, 88 fark (hepsi 2.4.6 sınıfında; 4'ü KS9 yolu).
- Senaryo kusuru (düzeltildi, e83879a): S5'in carisiz çeki programda 400 "Çeki kimden aldığınızı yazın ya da cari seçin." — koşucu ad göndermiyor; çek artık başka cariden alınır.

## 11. 2.4.6 BAŞ MİMAR KARARI DÜZELTMESİ (25.10 ~15:30 UTC) — KS8.3 GERİ ALINDI; K-b + KS8.1 iki aşama

### C00d Kaynak (temiz oda; ders 40 — kaynak önceden yazılmış kullanıcı kararları, programın davranışı DEĞİL)
- **Okunan:** ana oturumun iletisi (karar düzeltmesinin metni) ve ana çalışma kopyasının `docs/2.4.6-IS-LISTESI.md` K-b / K-c / KS8.1 / KS8.2 / K9.1 satırları. K-c'nin metni "tedarikçinin Tahsilat ile
  geri ödemesi alış iadesine BAĞLANIR (simetri)" — K-d'nin tedarikçi simetriği (açık bağ kurulabilir), bir SIRA kuralı değildir; sıra için yazılı karar K-b. **Okunmayan:** `server/**`,
  `client/**`; iş listesinin programın davranışını anlatan satırları kâhin kuralına girdi değildir.

### Kurallar (§10 KS8.3'ün yerine; iki taraf simetrik)
- **Birinci aşama — K-b [KULLANICI, 5 dk yetkisi]:** bağsız para (müşteriye Ödeme, K-e ile müşteriye ciro; tedarikçi tarafında bağsız Tahsilat ve alınan bağsız evrak) carinin karşı
  taraftaki yükümlülükleri (müşteride elle Alacak, alış faturası, alacak yönlü Açılış; tedarikçide satış faturası, elle Borç, borç yönlü Açılış, KS7.1 stok satışı) ve iadelerin AÇIK
  notları arasında TEK FIFO, en eski önce; iade kendi tarihinde; aynı tarihte yazım sırası (ders 31; olay sınıfı sırası kararda yok → YAYGIN).
- **Açık not:** iadenin geri ödemesiz hesapta (G = {}) hiçbir borcu kapatmadan artan kısmı — fatura iadesinde §7 kural 5–6 artanı, stok iadesinde d havuzunun artanı (en yeni stok
  iadesine önce; havuz en eskiden kapatır — paylaştırma kararda yok → başka bağsız kapatıcı varsa YAYGIN). Alış iadesinin açık notu borç tarafında aynı.
- **İkinci aşama — KS8.1 [BAŞ MİMAR]:** K-b'den ARTAN bağsız para, alacağı bir faturayı / borcu kapatmış iadenin geri ödemesi sayılır — en eski iade önce; üst sınır iadenin geri
  ödeme dışında kapattığı tutar; kapattığı açık yeniden açılır (kâhin en son kapatılanı önce açar — kısmi + birden çok kapama YAYGIN); fazlası avans (K-a).
- **KS8.2 [BAŞ MİMAR]:** tarih koşulu YOK (Ödeme iadeden önce tarihli olsa da). **K-d:** açık bağ (Kapatılacak Fatura = iade) önce — önce o iadenin açık notu, sonra kapatıcı kısmı.
- **KS9 yorumu (yeniden yazıldı):** "Alış İadesi bağsız ödeme; tedarikçinin bağsız Tahsilat'ı önce K-b FIFO'sunda (alacak tarafı + açık alış iadesi notu), artanı kapatıcı alış iadesinin
  geri tahsilatı — KS8.1 simetri, kapattığı açık yeniden açılır". Etiket BAŞ MİMAR (önceki "YAYGIN — KARAR GEREKİR K-c" kalktı); yaklaşık durumlarda YAYGIN.
- **Etiket (`ks8_sinif`):** "tam" → BAŞ MİMAR; "yaygin" → YAYGIN (İNCELE): aynı caride iki yönde iade (K9.1 BİLİNEN SINIR), tedarikçiden alınan evrakla geri tahsilat (K-e simetrisi),
  açık not + başka bağsız kapatıcı kaynağı, açık not ile karşı taraf yükümlülüğü aynı tarihte, kısmen geri ödenen iade birden çok borcu kapatmıştı.

### Mutantlar
133 = eski KS8.3 okuması (önce iadeler) · 142 = §9 ilk okuması (iadenin TAMAMI kendi tarihinde FIFO'da; KS8.1 "artan" yok) · 143 = ikinci aşama en yeni iade önce · 137 = ikinci aşama yok
(B2) · 141 / 138 / 136 / 131 / 129 / 130 / 134 / 135 aynen. Model tek başına: 141 mutantın hepsi yakalandı (elle 47 senaryo, iki kip; 25.10.2026).

### Senaryolar (elle tablo ↔ kâhin: 202/202, mutant beklentileri dahil)
- **c8 E:** fatura 200, Alacak 0, bakiye 200 (63a6537'deki ilk beklentiye dönüş; mutant 133: 500 / 300).
- **c13:** S1–S3 aynı gün üç yazım sırası → fatura 200, Alacak 0, bakiye 200 = Σ açık (yazım sırasından bağımsız — iadenin açık notu yok); S4 (KS8.2) fatura 500; S5 (K-e) fatura 500.
  YENİ: S6 Alacak iadeden SONRA tarihli → yine Alacak önce (fatura 200, Alacak 0; mutant 142: 500 / 300); S7 / S8 aynı gün Alacak + açık not 300 + Ödeme 300 — yazım sırası (S7 Alacak 0,
  bakiye −300, Σ açık 0; S8 Alacak 300 = bakiye) [YAYGIN]; S9 tedarikçi simetriği (alış 500 → Alış İadesi 300 → elle Borç 300 → bağsız Tahsilat 300 → Borç 0, alış 200; mutant 133: 500 / 300).
- **c12:** B1–B4 sayıları aynı (gerekçe K-b + KS8.1 ile yeniden yazıldı); YENİ B5 iki kapatıcı iade + bağsız Ödeme 200 → en eski iade (stok, 05-20) geri ödenir: FA5 500, FB5 0 (mutant 143: 300 / 200).
- **c8b:** değişmedi (bağlı Ödeme; bağsız sayılsaydı K-b'de açık not yok → KS8.1 en eski iade = stok → FF1 500, FF2 0 — mutant 136).
- Değişmeyenler: c8 A / A2 / B / C / D / S / S2, c11 (S-a).

### C13d Sonuç — aday246-3 8573193 kodu (ayrı kopya; kâhin 37af13c; kanıt `docs/kanit/2026-10-25/246-kahin-cari/*-37af13c.*`)
- **Bütün kâhin (39 senaryo: elle + rastgele ux18 / s1 tohum 1–2 + mutasyon):** 7.408 denetim, **0 fark (BULGU 0, İNCELE 0)**, yalnız 7 bilinen sınır (b3y — BILINEN.json, DONDURMA 23.10), okuma hatası 0;
  141 mutantın hepsi yakalandı (142 c13 + rastgele-s1-1, 143 c12, 133 c13 + c8, 137 c11 / c12 / c13). c11 (B1), c12 (B2 + B5), c13 (B3 + S6–S9), c8 E, c8b, c10 tutuyor; YAYGIN etiketli S7 / S8 (aynı gün
  yazım sırası) da programla aynı.
- **Ek rastgele s1 tohum 3–10 × 120:** 15.619 denetim, 0 fark.
- **2.4.5 kodunda (değişmemiş program; ders 7):** c8 / c12 / c13 889 denetim, 175 fark — 154 "2.4.6 kararıyla değişen beklenti" + 21 KS9 yolu, SINIF DIŞI 0. Nedenler iletide (ders 38): B5 "FA5 program 300 ·
  kâhin 500" (KS8 yok), S9 "AT9 50000 · 20000" (KS9 yolu 2.4.5'te yok), S8 "a8 0 · 30000" (iade notu yok). S1–S3, S6, c8 E 2.4.5 kodunda da yeşil (2.4.5'te iade geri ödemesi yok — Ödeme Alacak'ı kapatır, yeni
  kuralla aynı sonuç); bu senaryoların dişi eski okumalara karşıdır: mutant 133 (KS8.3) ve 142 (iadenin tamamı tarih FIFO'sunda) yakalandı. Program hiçbir adayda KS8.3'ü uygulamadı (bc1253c'de de K-b
  sırasındaydı — C13c'deki 97 "KS8.3 / K-c" farkı kâhinin geri alınan okumasıydı).
- **Eşdeğerlik:** `--kural 2.4.5` / `--legacy` = eski model (e77447a) 106/106. **Elle tablo:** 202/202. **Öz denetim** (Σ açık − dağıtılmamış giriş − Σ iade artanı − Σ borç açık + dağıtılmamış çıkış = bakiye):
  elle 65 cari + yeni üreticiyle 30 rastgele s1 senaryosu 43 cari, tutmayan 0.

## 12. 2.4.9 kuralları — kural seti `2.4.9` (03.11.2026, C1 "hareketli cari silinemez"; dil `/3` aynı, ekler aşağıda) — YENİ VARSAYILAN

Kural seti `2.4.9` = `2.4.6` + C1 (bu bölüm). `--kural 2.4.6` 2.4.6 beklentilerini bayt bayt verir (eski model b02874ba ile eşdeğerlik: elle 47 + rastgele, üç kip); koşucu her senaryoda
"2.4.9 kararıyla değişen beklenti" (2.4.6 ↔ 2.4.9 kâhin çıktısı farkı) kümesini kurar ve programla her farkı bu sınıfta mı diye yazar (C1 öncesi kodda — 35e90e47 — SINIF DIŞI 0 beklenir).
Kâhin, yazan ve programı yazan elden AYRI ajan (03.11.2026, temiz bağlam; ders 5, 40); kural metni bu bölüm, kodu `model.py` (`k249`), senaryolar `c14*`.

### C00e Temiz oda (2.4.9)
- **Okunan (karar metni):** CLAUDE.md (anayasa "Kalite çıtası", "Kalıcı ürün kararları", dersler 5, 7, 38, 40, 43); `docs/2.4.8-IS-LISTESI.md` 03.11 "MÜŞTERİ BULGUSU — İNCELEME" (cari silme),
  "KARAR (kullanıcı, 03.11 ~11:45 UTC, A)", "KARAR / İLKE (kullanıcı, 03.11 ~11:50 UTC)"; `docs/2.4.9-IS-LISTESI.md` C1 satırı ve "KULLANICI KARARLARI (03.11 ~18:48 UTC, C1)" (S1 A, S2 A, S3 A, BAŞ MİMAR
  KARARI yarış); `docs/2.4.9-tasarim/C1-hareketli-cari.md` §0, §2 (H1–H14 ve §2.1 — KARAR METNİ olarak; §13'te ana oturum onayı), §4 (S1–S3 seçenek metinleri ve gerekçeleri), §5 (cariyi kaldıran
  / geri getiren yollar), §13 (kullanıcı kararları + onay); bu klasörün önceki kâhin dosyaları.
- **Okunmayan:** `server/**`, `client/**`, `test/**` (kâhin klasörleri dışında), `docs/kanit/**` (önceki koşular), git farkları, tasarım notunun §1, §3, §6–§12 (kod ayrıntısı, test matrisi, bozulma listesi).
  İNCELEME satırı ve §2 tablosundaki kod göndermeleri (satır no, tablo adı) kural sayılmadı; kural yalnız tablonun "Ne" / "Yeni" sütunundan ve kullanıcı metninden.
- **Kara kutu yoklaması (yalnız ORTAM — uç, gövde, alan adı; not defteri `kahin-cari-249-yokla/yokla1–4.mjs`, b02874ba kodu):** cari kartı `GET /accounts/:id` → `status` ("active" / "passive"),
  `deleteBlock` (metin; boşsa silinebilir), silinmiş cari 404; `DELETE /accounts/:id` → 200 `{id}` / ret gövdesi `{error, code, …}`; Silinenler kalemi `kind: "account"`, `id: "account:<cariId>"`;
  taksit kartı `DELETE /plans/:id`, Silinenler `kind: "plan"`, `id: "plan:<kartId>"`; taslak fatura `DELETE /invoices/:id`, Silinenler `kind: "invoice"`, `ref` = fatura kimliği; Pasife Al `PUT
  /accounts/:id {…, status: "passive"}`; mal kartı `DELETE /stock/:id`; sıfır tutarlı taksit kartı `POST /plans {name, registeredOn, accountId, total: "0"}` (taksit bölümü yok — "Taksit kurulmadı"
  kartı). **Açıklama (ders 40):** yoklama yanıtlarında programın C1 davranışının bir kısmı da göründü (409 ve iletisi, sıfır kartın ve stok satırının `deleteBlock`'u, silinmiş cariye
  tahsilatın 404'ü, 0,00 TL taslak faturanın 400'ü). Aşağıdaki kurallar karar metninden yazıldı; yoklamadan kural ya da beklenen değer TÜRETİLMEDİ — yalnız "0,00 TL taslak fatura API'den
  kurulamıyor" bilgisi DENENMEYEN'e yazıldı, HTTP kodu kararda olmayan retlerde kod denetlenmez.

### Kurallar
- **C1.1 [KULLANICI KARAR A + İLKE; tanım BAŞ MİMAR §2 H1–H14, onay §13]** Hareket = cariye bağlı TUTAR TAŞIYAN her kayıt. Kâhinin kurduğu türler: H1 tahsilat (nakit, havale) / ödeme; H2 Borç Yaz /
  Alacak Yaz; H3 Açılış Bakiyesi; H4 stok hareketinin cari satırı (satış iadesi, cari hesaba stok satışı); H9 fatura — kesilmiş, TASLAK, İPTAL ("taslak/iptal dahil tutarlı her belge"), iade faturası;
  H11 çek/senet — alınan evrakın carisi ve CİRO ALAN cari; H12 taksit kartı. Biri varsa `cari_sil` → **ret** [KULLANICI], `http` **409** [BAŞ MİMAR — iş listesi C1 "silme 409"], `kod`
  **`account-has-movements`** [BAŞ MİMAR — tasarım §5 Y1, onay §13], cari pasif değilse ret iletisinde **"Pasife Al"** önerisi `pasifeAl` [YAYGIN — KARAR A "program 'Pasife Al' önerir … deleteBlock
  ile aynı yer"; önerinin yanıt iletisinde olması okuma, İNCELE]. Ret hiçbir şeyi değiştirmez: cari listede (`var`), bakiye, Kasa, Kasa raporu, mizan, takvim / projeksiyon kalemleri o kontrolün
  mevcut denetimleriyle AYNEN (müşteri bulgusunun belirtisi — silinen carinin nakdi Kasa'dan düşüyordu — `kasa` ve `kasaRapor:*` denetimleriyle).
- **C1.2 [KULLANICI KARAR A]** HİÇ hareketi olmayan cari silinir: `durum` ok, listede yok (`var` false), **Silinenler'de** (`silinenlerde` true) [BAŞ MİMAR §5 Y1 "hareketsizse yumuşak silme (Silinenler)"].
  Silme denemesi yapılan, pasife alınan ya da geri yüklenen her cari için her kontrolde `var`, `silinenlerde`, (listedeyse) **`silinebilir`** = hareketsiz mi [KULLANICI KARAR A "Sil düğmesi pasif +
  nedeni görünür yazı" — kartın `deleteBlock`'u boş mu] ve **`pasif`** [BAŞ MİMAR §5 G1] denetlenir.
- **C1.3 [KULLANICI İLKE "tutar taşımayan kayıtlar … değişiklik geçmişi hareket sayılmaz"]** Ad değişikliği (değişiklik geçmişi), telefon / not → hareket DEĞİL. **[BAŞ MİMAR §2.1 İLKEYLE]**
  kayıt (tablo) tahsilatı kayda bağlıdır, cariye değil → kayda bağlı carinin hareketi DEĞİL.
- **C1.4 [KULLANICI S1 A]** Yalnız Silinenler'deki kayıt (silinmiş tahsilat / Borç Yaz, silinmiş evrak, silinmiş taslak fatura, silinmiş taksit kartı) hareket SAYILMAZ → böyle cari silinir.
- **C1.5 [KULLANICI S2 A]** Tutarı sıfır taksit kartı ("Taksit kurulmadı") hareket SAYILIR.
- **C1.6 [BAŞ MİMAR §13 KARARI — değişmez "silinmiş caride para hareketi olmaz"; §4 S1 A gerekçesi "o kayıtların geri yüklemesi 'Önce cariyi geri yükleyin' der"]** Silinmiş cariye tahsilat, ödeme,
  Borç / Alacak Yaz, fatura, evrak, taksit kartı, stok satırı YAZILAMAZ; Silinenler'deki hareketi / evrakı / faturası, carisi silinmişken GERİ YÜKLENEMEZ → `durum` ret; Kasa, mizan aynı. HTTP kodu
  kararda yok → denetlenmez. (Eşzamanlı yarış sıralı kâhinde kurulamaz — DENENMEYEN; kâhin "silindikten SONRA yazım" sırasını denetler.)
- **C1.7 [KULLANICI KARAR A "daha önce silinmiş cariler Silinenler'den geri yüklenebilir kalır"]** `cari_geri_yukle` ok: listede, Silinenler'de değil. Cariden AYRI silinmiş kayıtlar Silinenler'de
  KALIR, sonra ayrıca geri yüklenir [BAŞ MİMAR §4 S1 A gerekçesi — "çıkmaz yok"]: cari geri gelince bakiye ve Kasa onlarsız; kayıt geri gelince Kasa'ya döner. **Geri yüklenen hareketli cari bir
  daha silinemez** (C1.1; §4 S3 A metni "geri yüklenen cari bir daha silinemez").
- **C1.8 [BAŞ MİMAR §5 R2 "değişmez" + §4 S1 A gerekçesi "taksit kartı geri yüklenince cariyi de geri getirir → çıkmaz yok"]** Silinenler'den taksit kartı geri yüklenince kartın silinmiş carisi de
  geri gelir; cari artık hareketli (C1.1).
- **C1.9 [BAŞ MİMAR §5 G1 "gizler (Pasif sekmesi), hareket korunur"; KARAR A öneri yolu]** `pasife_al` ok: `pasif` true; bakiye, Kasa, Kasa raporu, mizan AYNI. Pasif hareketli cari de silinemez
  (C1.1 — karar durum ayırmıyor; ret iletisinde Pasife Al önerisi denetlenmez, cari zaten pasif); pasif hareketsiz cari silinir (C1.2).
- **C1.10 [BAŞ MİMAR §5 Y2 + §13 "S1 A … Y2 kalıcı silmede yine sayılır"; KULLANICI KARAR A "cariyi kaldıran BÜTÜN yollar"; B1.6]** Taksit aktarımını Geri Al: aktarımın açtığı cari, aktarımın
  KENDİ kartı dışında hareketi varsa — Silinenler'deki dahil — KALIR (`var` true, bakiye kalan hareketlerden); yoksa kalkar (B1.6, YAYGIN aynen).
- **C1.11 [BAŞ MİMAR §2 H4 İLKEYLE]** Mal kartı silinmiş olsa da stok hareketinin cari satırı carinin hareketidir (bakiyede durur) → cari silinemez.
- **C1.12 [KULLANICI İLKE "cariye bağlı" + Kalite çıtası "aynı adlı iki kişi"]** Hareket CARİYE (kimliğe) bağlıdır, ada değil: aynı adlı iki cariden hareketsizi silinir, hareketlisi silinemez;
  silinip aynı adla yeniden açılan cari ayrı caridir.
- **Etiket:** `durum` KULLANICI; yalnız İLKEYLE dayanaklı karar (C1.3 kayıt tahsilatı, C1.11 ürünü silinmiş stok satırı, C1.8 kart geri yüklemesi, C1.10 Y2) BAŞ MİMAR — hepsi BULGU sınıfı.

### Dil ekleri (/3, 2.4.9)
`cari_sil {cari}` (2.4.9'da C1 denetimi) · `cari_geri_yukle {cari}` (Silinenler `account:<id>`) · `pasife_al {cari}` · `kart_ac {ad, cari, tutar: "0"}` → sıfır kart (gövde yalnız toplam; `mevcut`
yok) · `kart_sil {kart}` (yalnız tahsilatsız kart; kâhin başkasını kurmaz) · `kart_geri_yukle {kart}` · `fatura_sil {fatura}` (yalnız taslak) · `fatura_geri_yukle {fatura}` · `urun_sil` (stok adımlarının
mal kartı). Yeni çıktı anahtarları: `adim:<id>:{kod, pasifeAl}`, `<k>:cari:<ad>:{silinenlerde, silinebilir, pasif}`, `<k>:fatura:<ad>:var` (silinen / geri yüklenen taslak; YAYGIN).

### C8e Nasıl bozulur? (2.4.9 — önce yazıldı; senaryo karşılıkları)
| # | Bozulma | Senaryo |
|---|---|---|
| Z19 | Hareket tanımı eksik: bir tür (tahsilat, havale, ödeme, Borç/Alacak Yaz, açılış, stok satırı, kesilmiş / taslak / iptal fatura, alınan evrak, ciro alan cari, taksit kartı) tek başınayken cari silinir | c14a |
| Z20 | Sıfır tutarlı kart sayılmaz (S2 B); ürünü silinen stok satırı sayılmaz (H4) | c14a |
| Z21 | Ret bir şey değiştirir: silinemeyen carinin nakdi Kasa'dan / raporlardan düşer (müşteri bulgusu), bakiye değişir, cari listeden kaybolur | c14a, c14e |
| Z22 | Silinenler'deki kayıt sayılır (S1 B) ya da cari geri gelince ayrı silinmiş kayıtları da gelir; geri yüklenen hareketli cari yine silinir | c14b |
| Z23 | Kart geri yüklemesi silinmiş cariyi getirmez (çıkmaz) | c14b |
| Z24 | Silinmiş cariye yazım: tahsilat / ödeme / borç / fatura / evrak / kart / stok satırı; Silinenler'den hareket / evrak / fatura geri yükleme | c14c |
| Z25 | Aynı adlı iki cari: hareket ada göre aranır; sil + aynı adla yeniden aç; sil → geri yükle → sil | c14d |
| Z26 | Pasife Al bakiye / Kasa'yı değiştirir; pasif hareketli cari silinir; pasif hareketsiz silinemez | c14e |
| Z27 | Geri Al: aktarımın açtığı HAREKETLİ cari kalkar (tahsilat / taslak / iptal fatura / evrak / Silinenler'deki tahsilat yetim kalır); hareketsizi kalır | c14f |
| Z28 | Aşırı engel: ad değişikliği ya da kayıt (tablo) tahsilatı hareket sayılır; hareketsiz cari silinemez; silinen cari Silinenler'e gitmez | c14g, c14d |
| Z29 | Eski sürümde silinmiş hareketli cari (S3 A) | DENENMEYEN (eski sürüm verisi gerekir; yeni programda hareketli cari silinemez) |

### C10e Mutantlar (2.4.9)
150–174 (`model.py --mutasyonlar`; "C1" önekli): 150 hareketli cari silinebilir · 151 Silinenler sayılır (S1 B) · 152 sıfır kart sayılmaz (S2 B) · 153 taslak / iptal fatura sayılmaz ·
154 Borç / Alacak Yaz ve Açılış sayılmaz · 155 silinmiş cariye tahsilat yazılır · 156 geri yüklenen kayıt sayılmaz · 157 Y2: hareketli cari Geri Al'da kalkar · 158 Y2: Silinenler sayılmaz ·
159 silinen cari Silinenler'e gitmez · 160 Pasife Al nakdi Kasa'dan düşürür · 161 pasif hareketli silinir · 162 ciro alan cari sayılmaz · 163 stok satırı sayılmaz · 164 hareket ada göre ·
165 ad değişikliği sayılır · 166 kayıt tahsilatı sayılır · 167 hareketsiz de silinemez · 168 carisi silinmişken Silinenler'den geri yükleme · 169 cari geri gelince ayrı silinmiş kayıtları da gelir ·
170 kart geri yüklemesi cariyi getirmez · 171 ürünü silinen stok satırı sayılmaz · 172 alınan evrak sayılmaz · 173 ret Kasa'yı değiştirir (müşteri bulgusu) · 174 silinmiş cariye tahsilat dışı yazım.
Mutasyon taraması `/3` dosyalarını üç kural setiyle (2.4.9 + 2.4.6 + 2.4.5) değerlendirir. Model tek başına (elle 54 senaryo): 166 mutantın hepsi yakalandı (yeni 25'in her biri c14* ya da b5 ile).

### C14e Koşucu (ölçüm aracı) düzeltmeleri — kural DEĞİL (ders 38: neden ham satırda okundu)
- **Kart okuması:** silinen kart `GET /plans/:id` → 404; hata gövdesi kart sayılıyordu (`var` true). Yalnız 200 yanıtı kart (C1 öncesi senaryolarda kart silinmediği için görünmemişti).
- **Aynı adlı cari:** görünüm toplamlarında (`<k>:*:cariToplam:<cari>`) satır, ad başka bir canlı cariyle ortaksa adla değil yalnız kimlikle eşleşir. c14d ilk koşusunda A3'ün "Faturasız Cari Alacağı"
  satırı (`ref.id` = A3) aynı adlı A2'ye de sayıldı (program 40000 · kâhin 0); program satırı doğru carinin kimliğiyle veriyordu.
- **Silme denenen cari:** önceden silme denenen carinin bakiyesi hiç okunmuyordu (silme hep başarılıydı); artık cari listede ise okunur. Her cari için `var`, `silinenlerde`, `silinebilir`, `pasif` yazılır
  (kâhin yalnız C1.2'deki carileri denetler).

### C12e DENENMEYEN (2.4.9; neden)
- H5'in peşin tahsilat satırı ayrı (fatura H9 ile zaten hareketli), H6, H8 (POS iadesi, banka kaynaklı satır), H10 mahsup, H14 banka fişi: kâhin sürücüsünde yol yok. H13 şüpheli kaydı TEK BAŞINA
  (borcu silinmiş, yalnız şüpheli kaydı kalan cari) kurulmadı. H7 değersiz satırı yalnız şüpheli kayıtlı caride (zaten hareketli).
- S2 A'nın 0,00 TL'lik taslak faturası: API taslakta ödenecek tutar 0'ı kabul etmiyor (yoklama, ORTAM) → kurulamadı; S2 A yalnız sıfır kartla.
- S3 A (eski sürümde silinmiş hareketli cari): eski sürümün gerçek koduyla veri üretilmeden kurulamaz (ders 17) — kâhin yeni programda yalnız "geri yüklenen hareketli cari bir daha silinemez" yolunu
  C1.4 + C1.7 ve C1.8 üzerinden kurar.
- Excel / Sheets yeniden yükleme, toplu işlem, birleştirme (tasarım §5: cari kaldırmıyor / yok), Şirket Verisini Sıfırla (bilerek hariç), yedekten geri yükleme, kilitli dönem, yetkisiz kullanıcının silmesi,
  mobil yazma (ayrı kâhin), eşzamanlı silme + tahsilat yarışı (C1.6), Silinenler'de kalıcı silme (yok).

### C11e SORU (ders 43 — karar metni susuyor; kâhin bu yolu KURMAZ, kural yazılmadı)
- **S-Y2k — Aktarım kartına DOĞRUDAN taksit tahsilatı girildikten sonra Geri Al:** B1.6 yalnız "taşınan tahsilatlar cariye taksit dışı döner" der; aktarımdan SONRA karta doğrudan girilen tahsilat
  (H12 "taksit kartı ve tahsilatları") için ne olacağı yazılı değil — tahsilat Kasa'dadır, aktarımın açtığı cari Geri Al'da kalıcı kalkarsa nakit sahipsiz kalır (müşteri bulgusunun ailesi).
  **A (öneri):** Geri Al reddedilir (önce kart tahsilatları kaldırılır ya da kart tek tek silinir) — veri kaybı yok, hareket görmüş belge geri alınmaz (Logo / Mikro: işlem görmüş fiş geri
  alınmaz). **B:** Geri Al yürür, kart tahsilatı cariye taksit dışı tahsilat olarak döner, cari hareketli olduğu için KALIR (C1.10). **Gözlem (kural değil; not defteri `kahin-cari-249-gozlem/`, b02874ba):**
  program bugün 409 `touched` ile reddediyor (kart, cari, Kasa yerinde) — yani A. Karar A gelirse kâhine `c14f` adımı olarak eklenir.

### C13e Sonuç — b02874ba kodu (C1 kodlanmış; kâhin f1291f02; kanıt `docs/kanit/2026-11-03/kahin-cari/`)
- **Taban (eski kâhin, değişmeden):** `taban-b02874ba-eski-kahin` 39 senaryo, 7.408/7.408, 141 mutant yakalandı.
- **Yeni kâhin, bütün varsayılan çağrı (elle 54 + rastgele ux18 / s1 tohum 1–2 × 60 + mutasyon):** `kahin-249-f1291f02-program-b02874ba` 46 senaryo, **8.698/8.698, 0 fark** (yalnız 7 BİLİNEN b3y),
  okuma hatası 0; "2.4.9 kararıyla değişen beklenti" 630 denetim / 8 senaryo; **166 mutantın hepsi yakalandı** (yeni 150–174 dahil). Yeni senaryolar: c14a 424, c14b 257, c14c 91, c14d 107,
  c14e 87, c14f 249, c14g 74 denetim — hepsi tuttu.
- **C1 öncesi kodda (35e90e47, ayrı kopya `git archive`; ders 7, 23, 38):** `kirmizi-c14-eski-kod-35e90e47-kahin-f1291f02` c14a–g + b5: 1.323 denetim, **318 fark** — 297'si "2.4.9 kararıyla değişen"
  sınıfta (hareketli cari siliniyor: `durum` program "ok" · kâhin "ret", `http` 200 · 409, kart `var` / `bakiye` yok; Geri Al'da tahsilatlı / taslak faturalı aktarım carisi kalkıyor). SINIF DIŞI 21:
  hepsi müşteri bulgusunun belirtisi — silinen hareketli carinin nakdi `kasa`, `kasaRapor:*`, `mizan:100` / `mizan:120`'den düşüyor (2.4.6 kâhini Kasa düşüşünü hiç modellemediği için sınıfa girmez)
  ve `sil-m4` (eski Geri Al Silinenler'de tahsilatı olan carisi kalıcı sildi; sonra Sil 404). **c14c eski kodda da yeşil (91/91):** silinmiş cariye SIRALI yazım C1'den önce de reddediliyordu;
  C1'in düzelttiği eşzamanlı yarış sıralı kâhinde kurulamaz (DENENMEYEN) — c14c'nin dişi mutant 155 / 174.
- **Eşdeğerlik:** `esdeger-249-f1291f02` (betik `esdeger-249.sh`) — `--kural 2.4.6` / `2.4.5` / `--legacy` çıktıları eski modelle 159/159 bayt bayt aynı + üretici 6/6; c14 dışındaki elle ve rastgele
  senaryolarda 2.4.9 = 2.4.6, tek fark b5 (`cari_sil`'li: `silinenlerde`, durum etiketi).
- **Komşu testler (kara kutu):** ekstre-ayrinti-245, mobil-yazma-247, platform-tasinabilirlik, lisans-servisi-izolasyonu, ci-kapi-listesi 42/42. Mobil yazma kâhininin `kabul.json`'u
  (`cari_model_sha256`) yeniden üretildi: kabul kümesi bayt bayt aynı, yalnız sha satırı değişti (mobil kâhin cari kâhinini `kural 2.4.6` ile kullanır — eşdeğerlik yukarıda).

## 13. 2.5.0 Ç5 bakımı — kural seti `2.5.0` (06.11.2026; BAŞ MİMAR KARARI B17 "eski kâhinler Ç5 birleşmeden önce kodu görmeyen ajanla bakım") — YENİ VARSAYILAN

Kural seti `2.5.0` = `2.4.9` + bu bölüm. `--kural 2.4.9` 2.4.9 beklentilerini bayt bayt verir (eşdeğerlik: eski model `d9ac9c14` ile). Bu dal ana dala Ç5-A (açılış düzeni) ile birlikte girer;
Ç5-B (B1 tek yükümlülük kuyruğu) ve Ç5-A birleşmeden önce programla ayrışma BEKLENİR. Koşucu her senaryoda "2.5.0 kararıyla değişen beklenti" (2.4.9 ↔ 2.5.0 kâhin çıktısı farkı) sayar.

### C00f Temiz oda (2.5.0)
- **Okunan (karar metni):** CLAUDE.md (anayasa, dersler 1–48, SORU DÜZENİ, Açık iş "2.5.0'a AÇILIŞ KAYITLARI DÜZENİ (30.10)"); `docs/BAGIMSIZ-DOGRULAMA-PRENSIBI.md`; `docs/2.5.0-IS-LISTESI.md` A, C,
  D (05.11 "hepsi A" 11 para kuralı; EK-1 S1–S5; 05.11 21:30 (1)–(7); S7, S8; 06.11 S11–S53; BAŞ MİMAR KARARLARI B1–B17); `docs/erp/MUHASEBELESTIRME-KURAL-KITABI.md` (tamamı);
  `…-EK-1.md` §0, §1 (Tek Yükümlülük Kuyruğu), M1–M3, M7, §3–§7; `…-EK-2.md` başlık, soru 37–40, K-1; `…-EK-2B.md` §0, §1 (madde 23, 24, 28, 32, 33, 35); `docs/erp/MUHASEBE-CEKIRDEGI-PLANI.md` §0, §6, §9,
  §13, §14 (bir aramada §1'in iki satırı ekrana geldi — kullanılmadı); bu klasörün dosyaları; defter kâhininin `kahin.py` / `kos.mjs` / `karsilastir.mjs`'i (eşleme için).
- **Okunmayan:** `server/**`, `client/**`, `bulut/**`, `packaging/**`, `tools/**` (yalnız `kanit.mjs` çalıştırıldı), `docs/erp/C5-ACILIS-TASARIM.md` (kod planı — aynı el riski), `test/**` (iki kâhin
  klasörü dışında), `docs/kanit/**`, git farkı / geçmiş içeriği. Program koşulmadı; programın davranışı aranmadı.

### Kurallar
- **C13.1 Açılış karşı hesabı 519** [KULLANICI 30.10 açılış düzeni; kitap M-02 / M-03; KG-1 A (çekirdek §13)]: Açılış Bakiyesi borçlu B 120|320 / A 519, alacaklı B 519 / A 320|120. Alacak yönlü
  açılış artık mizan denetimini KAPATMAZ (2.4.9'da "TDHP karşılığı bu kâhinde yok" diye kapanıyordu — M-03 karşılığı verdi). Etiket KULLANICI.
- **C13.2 KG-5 Tablodan / Excel'den yüklenen taksit kartı açılış alacağıdır** [KULLANICI KG-5 = A; BAŞ MİMAR B5]: Tablodan Aktar'ın (anahtar açık sunucuda) YENİ BORÇ kartı (mevcut borç değil;
  B1.4 D ≤ 0, faturalı cari B1.5, seçenek kapalı) TEK MADDE B 120 K / A 519 (K = kart tutarı = tablodaki kalan, B1.3 — T − P; P maddesiz; tarih yükleme günü, kümülatif mizanda görünmez).
  "Mevcut borcu taksitlendir" kartı madde yazmaz (kitap H-02). Geri Al kartı ve maddesini kaldırır. Aktarım artık mizan denetimini kapatmaz. (Taksitler'den açılan Yeni Borç kartı — `kart_ac
  {mevcut: false}` — kitap H-03 / KG-2'dir, Ç7b'de; mizanı DEĞİŞMEDİ.) Etiket KULLANICI.
- **C13.3 S49 formdan carisiz evrak** [KULLANICI S49 = A]: `evrak {cari: null}` (faturasız) alınan çek / senet B 101|121 / A 649 (649.90). Carisiz evrakın karşılıksızı kararda yok (SK-2) → o
  senaryoda mizan denetlenmez, `belirsiz`'e yazılır. Etiket KULLANICI. (Bakım 2: S66 = A — karşılıksızı §14 C14.3.)
- **C13.4 TEK YÜKÜMLÜLÜK KUYRUĞU (TYK) — kapama sırası** [KULLANICI S50 = A ("kart seçilmeden alınan tahsilat ayrı taksit kartının vadesi gelmiş taksitini de kapatır (tek yükümlülük kuyruğu);
  Taksitler, zil ve takvim bunu gösterir"); KULLANICI S2 = A ("vadesi en önce gelen", TBK 102); KULLANICI S1 = A (vadesiz kalem = belge günü); KULLANICI 05.11 21:30 (1) = A ("Ödeme Günündeki Borcu
  Kapatsın"), (2) = A ("bağ hedefini her durumda kapatır"); BAŞ MİMAR M1a, M1e, M1f (EK-1 §6, kullanıcıya gösterildi); EK-1 §1; EK-2B 23, 24] — 2.4.5'teki S1'in "kayıt tarihi + yazım sırası,
  Vade sırayı değiştirmez" okuması bu kararlarla DEĞİŞTİ:
  1. Kalemler (carinin BORÇ tarafı): taksitsiz satış faturası, elle Borç, borçlu Açılış, KS7.1 stok satışı, her aktif taksit kartının taksitleri (Taksitler'den kart, Tablodan Aktar kartı) ve taksitli
     satış faturasının kendi kartının taksitleri (eşit tutar, artık kuruş sonda, ilk vadeden ayda bir — [YAYGIN], `kart_ac`'la aynı varsayım). Her kalemin belge tarihi d, vadesi v (elle kayıt / açılışta
     Vade Tarihi; taksitte taksit tarihi; yoksa v = d — S1 A), yazım sırası s. Beklenen Ödeme Tarihi (Ödeme Sözü) sırayı DEĞİŞTİRMEZ (S2 "vade"; S52).
  2. Sıra: v artan → d → s (S2 A; EK-1 §1 adım 4; ders 31).
  3. Bağlar önce ((2) A; EK-2B 24): faturaya bağlı tahsilat / evrak (faturanın kendi evrakı dahil), kart tahsilatı (karta doğrudan girilen ya da Tablodan Aktar'ın taşıdığı), satış iadesinin asıl
     faturası — hedefini zamandan bağımsız kapatır (kart tahsilatı kartın vadesi ilk gelen açık taksitinden, fazlası sonrakine); hedefin kalanını aşan kısım kendi tarihinde BAĞSIZ alacaktır.
  4. ANINDA ((1) A; EK-2B 23): bağsız alacak (bağsız tahsilat ve evrak, satış iadesinin artanı, faturasız stok Satış İadesi, Değersiz Alacak Yaz, bağ fazlaları) KENDİ TARİHİNDE açık olan kalemlere
     2'deki sırayla dağılır; aynı gün önce o günün borç kalemleri sayılır; artan avanstır, sonra doğan kalemlere doğdukları gün aynı sırayla uygulanır; kapanmış kalem sonradan doğan bir kalem
     yüzünden yeniden AÇILMAZ; geriye tarihli kayıt kendi tarihinde girmiş sayılır (giriş saatine bağlı değil).
  5. S50 A + M1a: kart seçilmeden alınan tahsilat taksitleri de kapatır — taksitler 1'deki kalemlerdir, 2'deki sırayla (vadesi gelmiş taksit önce gelir; vadesi gelmemiş ama öbür borçlardan erken
     vadeli taksit de aynı sırada — "tek kuyruk"; kâhin okuması, kaynak S50 "tek kuyruk" + M1a + S2).
  6. M1e: "Carinin Mevcut Borcu" kartı açıldığı gün (kartın tarihi, yazım sırasıyla) kart tutarı kadar açık borç kalemini 2'deki sırayla TÜKETİR; "Bu Satışı Taksitlendir" (taksitli fatura) kendi
     faturasını tüketir; yeni borç kartında borcun kaynağı karttır. Kuyrukta yalnız taksitler kalır (kart ile alttaki borç birlikte sayılmaz).
  7. Defter kalanı (K6.5 (a) AYNEN): faturanın açığı ve elle kaydın Kalan'ı Mevcut Borç kartının kapsadığı kısmı İÇERİR — kalan = kuyruk kalanı + (tüketilen − kartın ödenen kısmı). Kart birden
     çok kalemi tükettiyse ödemenin kalemlere dağılımı kararda yok → o carinin kalan / açık denetimleri yapılmaz (2.4.9'un tanım alanı genişletilmedi). Taksitli faturanın açığı = kendi kartının
     ödenmemiş taksitleri (kartına ödeme ulaşmadıysa 2.4.9'daki gibi tutarın tamamı). Takvim / Vade Takip tutarı (K6.5) = kuyruk kalanı.
  8. Karşılıksız (S8 = A, K-1): bağsız evrak karşılıksız dönünce alacak kalemi kalkar, kapattığı kalemler kendi vadeleriyle açılır (kâhinde B2.2'den beri: karşılıksız evrak kapatıcı değil).
  9. İki taraf AYRI (KS2 aynen; (5) A "faturaların Açık / Ödendi durumu yalnız Mahsup Et ile"): carinin ALACAK tarafı (alış faturası, elle Alacak, alacaklı Açılış; bağsız Ödeme, ciro,
     alış iadesi) 3–4 kurallarıyla ayrı kuyrukta; iki taraf birbirini kapatmaz. Bu taraftaki SIRA kararda yok (S2 müşterinin ödemesi için verildi; 2.4.5 S1 "simetrik" + K-b "kayıt tarihi") →
     **SK-4**: kâhin iki dalı hesaplar (A vade sırası / B kayıt tarihi + yazım sırası), ayrışan her denetim ÇATAL (etiket YAYGIN; tarih sıralı alanda iki dal aynı).
     (Bakım 2: S68 = A — vade sırası, ÇATAL kalktı; §14 C14.1.)
     (Kod yazılırken görüldü: c13 S7'de vade 18.06'lı elle Alacak ile aynı gün iade notu — program koşulmadan, karar metni okunarak; ders 40, 43.)
  10. KS8 / KS9 (2.4.6, AYNEN) bu kuyruğun içinde: K-b'nin "tek FIFO"su 2'deki sıra + 4'teki zaman; KS8.1'in ikinci aşaması (artan para → kapatıcı iadenin geri ödemesi, en eski iade önce) zaman
      çizelgesinin SONUNDA kalan bağsız paradan. Aynı anda birden çok bağsız kaynak bekliyorsa öncelik 2.4.9'daki gibi: satış iadesinin artanı → öbür bağsız kapatıcılar (stok iadesi, değersiz, bağ
      fazlası; borç tarafında alış iadesi) → tahsilat / evrak (borç tarafında Ödeme / ciro); kaynak içinde tarih → yazım sırası. (Kaynaklar arası öncelik kararda yok — 2.4.9 korundu; (1) gereği
      önce tarihli ödeme kendi tarihinde açık borcu kapatır, sonra gelen iade kapanmış borcu yeniden açmaz → iade açık not kalır.)
  11. Tanımsız (2.5.0'da o carinin kalan / açık / kart denetimleri yapılmaz, `belirsiz`'e yazılır): taksitli faturanın iadesi (kartın küçülmesi (4) / 2B-S3 Ç7b'de); Mevcut Borç kartı açık
      borçtan büyük (EK-2B 32); Mevcut Borç kartı birden çok kalemi tüketti (7).
  Etiket: 2.4.9'daki etiketler (KULLANICI / BAŞ MİMAR / YAYGIN / AJAN) korunur; kural metni "S1 FIFO" yerine "TYK".
- **C13.5 B1 gecikmiş tutarı** [KULLANICI S52 = A ("vadesi geçmiş borca ileri tarihli Ödeme Sözü → borç gecikmiş sayılır, söz tarihine kadar otomatik hatırlatmaya girmez"); S1 = A; (5) = A
  "gecikmiş tutar carinin net borcunu aşmaz"; BAŞ MİMAR M1e, M1f; EK-1 §1 adım 5]: `kontrol {gecikmis: true}` → `<k>:cari:<ad>:gecikmis` = min(max(0, bakiye), Σ kuyruk kalanı {v < bugün}).
  Ödeme Sözü gecikmişi DEĞİŞTİRMEZ; vade günü gecikmiş değildir (M1f); vadesiz kalem ertesi gün gecikmiştir (S1); kartın tükettiği kalem sayılmaz, taksitleri sayılır (M1e); tedarikçi / bize alacaklı
  cari 0. Otomatik hatırlatmanın elemesi ("Ödeme Sözü Var", S7 ailesi) WhatsApp kâhininde / Ç5-C'de — burada YOK. Şüpheli kaydı olan cari tanımsız (M13 şüpheli kuyruğu; denetlenmez). Etiket KULLANICI.
- **C13.6 S52 ↔ takvim kalemi** (SK-3 — bakım 2'de S67 = A ile §14 C14.2 YERİNE GEÇTİ): elle kaydın vadesi geçmiş (ya da vadesiz, belge günü geçmiş) ve Beklenen Ödeme Tarihi bugün ya da sonra ise takvim / zil kaleminin `state`'i ve `days`'i
  ÇATAL (K6.3 söz günü ↔ S52 "gecikmiş"); öbür alanlar (tutar, tarih = Beklenen, etiket "(Ödeme Sözü)") K6.3 aynen.

### Dil ekleri (/3, 2.5.0)
`kontrol {gecikmis: true}` · `evrak {cari: null}` (faturasız; S49) · `kart_ac`'ın `tarih`'i kuyruk tarihidir (2.4.9'da yalnız gövdedeydi) · `aktar`'ın tarihi yoksa `bugun`. Yeni çıktı anahtarı:
`<k>:cari:<ad>:gecikmis`. 2.5.0'da her mizan denetiminde 500 ve 519 da (sıfır olsa da) yazılır. Senaryo dosyasında yalnız `oz-test.py`'nin okuduğu `elleBeklenen` (elle hesaplanmış
beklenenler, kuruş), `elleCatal` (ÇATAL dalları), `elleYok` (tanımsız — kâhinin yazmaması gereken anahtarlar).

### Öz denetim (`oz-test.py`, program AÇILMAZ)
Elle tablolar (d1–d8) · mutantlar 200–213 (değerle) · tek yükümlülük kuyruğunun SAF (model.py'den ayrı yazılmış) zaman çizelgesi simülasyonuyla çapraz denetimi (fatura / elle Borç / Açılış /
tahsilat / evrak olan carilerde; elle /3 + rastgele s1 / ux18 tohum 1–3) · tarih sıralı alanda (vadesiz, kartsız) 2.5.0 = 2.4.9.

### C8f Nasıl bozulur? (2.5.0 — önce yazıldı; senaryo karşılıkları)
| # | Bozulma | Senaryo |
|---|---|---|
| Z30 | Açılış hâlâ 500'de; alacaklı açılışın karşılığı ters yönde | d1-c5-acilis-519 |
| Z31 | Tablodan Aktar yeni borç kartı gelire (600) yazılır ya da hiç yazılmaz; Mevcut Borç kartı da madde yazar | d2-c5-kg5-excel-kart |
| Z32 | Carisiz evrak 602 / 519 / 120'ye | d3-c5-carisiz-evrak |
| Z33 | Kart seçilmeden alınan tahsilat taksiti kapatmaz; ayrı kartın vadesi gelmiş taksiti açık kalır; kart ödeneni yalnız kart tahsilatı | d4-c5-s50-tek-kuyruk |
| Z34 | Kapama kayıt tarihine göre (vade sırayı değiştirmez — 2.4.9); aynı adlı iki cari karışır | d5-c5-s2-vade-sirasi |
| Z35 | Bağsız ödeme sonradan doğan erken vadeli borca kayar (HAVUZ), kapanmış fatura yeniden açılır ("hayalet") | d6-c5-aninda |
| Z36 | Ödeme Sözü gecikmişi siler; vade günü gecikmiş sayılır; vadesiz kalem hiç gecikmez; gecikmiş net borcu aşar; Mevcut Borç kartıyla çift sayım | d7-c5-s52-gecikmis |
| Z37 | Açılış önce / hareket önce sıra; kart açılmadan önceki tahsilat karta sayılır | d4, d6 |
| Z38 | Kararın çözmediği durumda kâhin değer uydurur (Mevcut Borç kartı iki kalemi tüketir; taksitli faturanın iadesi) | d8 |

### C10f Mutantlar (2.5.0)
200–213 (`model.py --mutasyonlar`; "Ç5" önekli): 200 açılış karşı hesabı 500 (30.10 B) · 201 alacaklı açılışın karşılığı ters yönde · 202 KG-5 B: Excel kartı gelir (B 120 / A 600) · 203 KG-5: Mevcut Borç
kartı da madde yazar · 204 S49 B: carisiz evrak 519'a · 205 S50 B: kart seçilmeden alınan tahsilat taksit kapatmaz · 206 S2 B: belge tarihi sırası (Vade sırayı değiştirmez) · 207 (1) B: HAVUZ (ödeme
sonradan doğan borca kayar) · 208 M1e B: Mevcut Borç kartı alttaki borcu tüketmez (çift sayım) · 209 S52 B: ileri tarihli Ödeme Sözü varken gecikmiş sayılmaz · 210 S1 B: vadesiz kalem gecikmez ·
211 M1f B: vade günü gecikmiş · 212 (5) B: gecikmiş net borçla sınırlanmaz · 213 (2) B: bağ hedefi önceden bağsız kapanmışsa bağ bağsız olur ("ilk gelen kazanır").

### KULLANICIYA SORULMALI (kâhin bu durumları KURMAZ) — SK-2 / SK-3 / SK-4 YANITLANDI 06.11 12:16 UTC (S66 / S67 / S68 = A; kural §14 — C13.3 / C13.6 / C13.4 (9)'un yerine)
- **SK-2 (S48 ↔ S49 arası; para):** formdan girilmiş CARİSİZ (açılış değil) alınan evrak karşılıksız dönerse? **A (öneri):** S48 gibi program cariyi sorar; seçilirse cari borçlanır (B CH / A 101),
  seçilmezse alışın tersi B 649.90 / A 101 (gelir geri alınır). **B:** seçilmezse B 770.90 / A 101 (gider). **C:** uç durum böyle kalsın (BİLİNEN SINIR).
- **SK-3 (S52 ↔ takvim kalemi; sunum, UÇ):** vadesi geçmiş borca ileri tarihli Ödeme Sözü varken Tahsilat Takvimi / zil kaleminin durumu ve gün sayısı? **A (öneri):** kalem söz gününde durur, durumu
  "Gecikmiş" (borç gecikmiş sayılır — S52), gün sayısı vadeden. **B:** durum ve gün sayısı söz tarihine göre (bugünkü). **C:** uç durum böyle kalsın (BİLİNEN SINIR). Kâhin ÇATAL.
- **SK-4 (kapama sırası — ders 43; borç tarafı):** BİZİM cariye bağlamadan yaptığımız ödeme (tedarikçiye Ödeme, müşteriye iade bedeli, ciro) birden çok açık alacağı (alış faturası, elle Alacak,
  alacaklı Açılış, iade notu) varken önce hangisini kapatsın? Örnek: 01.06'da müşteriye elle Alacak 300 (vade 18.06) ve aynı gün stok iadesi 300 (açık not); aynı gün Ödeme 300 — **A (öneri):** S2'nin
  simetriği, vadesi en önce gelen (iade notu → Alacak 300 açık kalır; tek yükümlülük kuyruğu iki tarafta aynı kural). **B:** bugünkü gibi kayıt tarihi + yazım sırası (2.4.5 K-b; Alacak önce
  yazıldıysa Alacak kapanır). Kâhin ÇATAL.

### C12f DENENMEYEN (2.5.0; neden)
- Açılış evrakı (S48, M-08 / M-09), KG-16 / S47 / S51 göç listesi, Kural Farkı fişi (KG-15), kilitli dönem eski kuralla (Ç3 / S13), S12 / B11 Kasa: defter kâhininde (`test/bagimsiz/defter/KARARLAR.md`);
  cari kâhininin dilinde Kasa açılışı, açılış evrakı ve eski sürüm verisi yok.
- B1 gecikmiş alanının programdaki adı bilinmiyor (Ç5-B ortak yardımcısı): koşucu `okunamadı` yazar (ders 4) — eşleme notu.
- KG-5'in tarihi (B5) ve "tek madde": kümülatif mizanda görünmez.
- WhatsApp elemesi (S7, S52'nin hatırlatma kısmı "Ödeme Sözü Var"): WhatsApp kâhininde / Ç5-C.
- Taksitli faturanın iadesinde kart küçülmesi ((4), Ç7b); Kartı Kapat kalanı ((6), Ç7b); kilit sınırında bağ (2B-S2 / (3)) — cari kâhininin dilinde kilitli bağ yok.

### C0f Değişen eski beklentiler (G3; 2.4.9 ↔ 2.5.0 kâhin çıktısı, elle senaryolar d* hariç + rastgele tohum 1–3) — kararla ilgisiz eski beklenti DEĞİŞMEDİ
- **C13.1 (30.10 / M-02):** b1-5a-bayat-ve-yeniden, b1-5a-tasima, b1-5c-rapor — `mizan:500` (açılış) → 0, `mizan:519` eklendi (10 denetim); bütün mizanlı /3 senaryolarında `mizan:500` = 0 ve
  `mizan:519` yazılır (84 + 94 yeni denetim — 36 senaryo).
- **C13.2 (KG-5) + C13.1:** c2-tablodan-aktar-kapisi, c6c-mevcut-borc-karti, c14f-c1-geri-al-y2 — aktarım artık mizanı kapatmıyor: bütün mizan denetimleri YENİ (80; c6c Mevcut Borç kartı maddesiz,
  c2 / c14f yeni borç kartı B 120 / A 519).
- **C13.4 (S2 vade sırası + S1 vadesiz = belge günü):** c6-cari-vade-fifo (131: Kalan 38, fatura açığı 2, takvim / Vade Takip / projeksiyon kalemleri), c10-ks10-projeksiyon-cari-vade (69 + 5),
  c7-ks7-bagsiz-kapaticilar (20; senaryo açıklamasındaki "Açılış 400 kalır" 2.4.9 beklentisi — 2.5.0'da önce fatura (vadesiz → 20.05), Açılış (vade 31.05) sonra), rastgele s1 tohum 1–3 (310 + 9 kalkan).
  Elle tabloyla doğrulandı: c6 k1–k10 (ör. k1: fatura 800 + Açılış 400 kapanır → Açılış 600; 2.4.9: Açılış 0, b1 300, fatura 800), c10 G / H, c7 k2 / k4.
- **SK-4 ÇATAL:** c13-ks83-ayni-gun-sira S7 (8: elle Alacak 300 vade 18.06 ↔ aynı gün iade notu — A dalında Alacak açık, B dalında kapalı; senaryonun "yazım sırası" denetimi B dalında aynen).
- rastgele ux18 tohum 1–3: yalnız `mizan:500` / `519` eklendi (açık / Kalan değerleri 2.4.9 ile AYNI — vadesiz alanda ANINDA = HAVUZ, bağlar önce = 2.4.9 kapaması).

### Eşleme notları (Ç5-A / Ç5-B kod ajanı için; `kos.mjs`)
- Kural seti listesine `2.5.0` (varsayılan), "<KURAL> kararıyla değişen" için önceki `2.4.9`; mutasyon taraması /3 dosyalarında dört kip (2.5.0 + 2.4.9 + 2.4.6 + 2.4.5).
- `kontrol {gecikmis: true}`: carinin B1 gecikmiş tutarı `GECIKMIS_ALAN`'dan okunur — alan adı Ç5-B'de verilir (verilene kadar `okunamadı`, fark sayılır).
- `evrak {cari: null}`: `POST /cheques` `accountId` olmadan (koşucu zaten böyle gönderir).
- `uretici.py` rastgele senaryoları `kural 2.4.9` modeliyle üretir (bağlı tahsilat tutarının üst sınırı); senaryolar bayt bayt aynı kalır, 2.5.0 kâhini onları kendi kuralıyla değerlendirir.
- **Ana oturuma:** mobil yazma kâhininin `kabul.json`'undaki `cari_model_sha256` bu `model.py` için yeniden üretilmeli (o dosya bu ajanın okuma alanı dışında — okunmadı, değiştirilmedi;
  mobil kâhin `kural 2.4.6` kullanıyorsa kabul kümesi aynı kalır, eşdeğerlik aşağıda).

## 14. 2.5.0 Ç5 bakımı 2 — S65–S68 (06.11.2026; eski kâhinler bakımı 2 — kodu görmeyen AYRI el) — kural seti `2.5.0` = §13 + bu bölüm

`--kural 2.4.9` (ve 2.4.6 / 2.4.5 / `--legacy`) AYNEN — bakım 1'in modeliyle (`a5a89a1f`) bayt bayt eşdeğerlik kanıtta. Bu dal ana dala Ç5-A ile birlikte girer.

### C00g Temiz oda (bakım 2)
- **Karar metni:** KULLANICI KARARI 06.11 12:16 UTC (AYNEN "önerilerini uygula"; `git show a4ef1268:docs/2.5.0-IS-LISTESI.md` D "S65–S68 = A", sorular C S65–S68):
  S66 = A "formdan carisiz (açılış değil) alınan evrak karşılıksız dönerse program cariyi sorar; seçilirse cari borçlanır, seçilmezse B 649.90 / A 101 (S49 geliri geri alınır)." ·
  S67 = A "vadesi geçmiş borca ileri tarihli Ödeme Sözü varken takvim kalemi söz gününde durur, durumu 'Gecikmiş', gün sayısı vadeden." ·
  S68 = A "bizim bağlamadan yaptığımız ödeme (tedarikçiye, iade bedeli, ciro) vadesi en önce gelen kalemi kapatır (S2'nin simetriği; tek yükümlülük kuyruğu iki yönde)." ·
  S65 bu kâhinin dilinde yok (göç / "Açılış Olabilir" — defter kâhini D6′).
- **Okunan / okunmayan:** bakım 1'in alanıyla aynı (C00f); tam liste ajan raporunda. Program koşulmadı, programın davranışı aranmadı.

### Kurallar
- **C14.1 S68 = A — borç tarafında da vade sırası (SK-4 kapandı; C13.4 (9)'un sıra cümlesinin YERİNE):** carinin ALACAK tarafı kuyruğu (alış faturası, elle Alacak, alacaklı Açılış, müşteriye iade
  kaleminin AÇIK notu) C13.4 (2)–(4) ile AYNI kuralla kapanır: sıra vade → belge tarihi → yazım sırası (vadesiz kalemde v = d — S1 A; iade notunun vadesi iadenin günü); bağlar önce (3);
  ANINDA (4). Kapatanlar: bağsız Ödeme (tedarikçiye; müşteriye iade bedeli — KS8), ciro (K-e), alış iadesi (KS9). Kuyruğun sırası KALEMİN özelliğidir, kaynağa göre ayrı sıra yoktur
  (C13.4 (2)'deki yapı; metin "tek yükümlülük kuyruğu iki yönde"). Kaynaklar arası öncelik (alış iadesi → Ödeme / ciro) C13.4 (10) aynen (kararda yok — değişmedi). İkinci dal (2.4.5 K-b kayıt
  tarihi + yazım sırası) ARTIK HESAPLANMAZ: ÇATAL ve "yalnız A dalında tanımlı denetimi silme" kalktı. KS8.1 ikinci aşaması ("en eski iade önce") aynen — iade kaleminin vadesi belge günü,
  vadesi en önce gelen = en eski. **Etiket:** `ks8_sinif`'in "açık not ile karşı taraf yükümlülüğü AYNI tarihte (olay sınıfı sırası kararda yok — kâhin yazım sırası)" YAYGIN nedeni 2.5.0'da
  DÜŞER — eşit vadede sıra EK-1 §1 adım 4 (M1a, BAŞ MİMAR, kullanıcıya gösterildi; S2 A + S68 A ile iki yönde) belge tarihi → yazım sırası; öbür YAYGIN nedenleri (iki yönde iade,
  açık notun öbür kaynaklardan ayrılamaması, ikinci aşamada birden çok borç) aynen. Denetimlerin etiketi 2.4.9 düzeninde (BAŞ MİMAR / PLAN / KULLANICI — BULGU sınıfı); ÇATAL'ın YAYGIN'ı kalktı.
- **C14.2 S67 = A — takvim kalemi (SK-3 kapandı; C13.6'nın YERİNE):** elle kayıt / Açılış kalemi (K6.3), vadesi v < bugün (vadesizse v = belge günü — S1 A; vade günü gecikmiş değil — M1f) ve
  Beklenen Ödeme Tarihi > bugün → kalem `dueDate` = Beklenen (K6.3 aynen, "söz gününde durur"), `state` = "overdue", `days` = v − bugün (eksi; K6.3'ün "dueDate − bugün" işaret düzeni);
  `amount` / `label` / `direction` / `person` K6.3 aynen. **Yorum (harfiyen):** iki yön (Tahsil Edilecek Borç / Ödenecek Borç) — metin "vadesi geçmiş borç" yön ayırmıyor, K6.3'te iki kalem de
  "Borç". Vade Takip ve projeksiyon satırı (`{amount, date, direction}`) değişmez. ÇATAL kalktı.
  - **SK-5 sınırı (KULLANICIYA SORULMALI, aşağıda):** v < bugün ve v < Beklenen ≤ bugün (söz günü BUGÜN ya da söz GEÇMİŞ) — "ileri tarihli" bugüne göre mi (K6.3: bugün → "today" / 0, geçmiş →
    "overdue" / sözden) vadeye göre mi (S67: "overdue" / vadeden): kâhin ÇATAL {K6.3, S67}, etiket YAYGIN. Beklenen ≤ v (söz vadeden önce ya da vade günü) iki okumada da "ileri tarihli"
    değildir → K6.3 aynen (kesin).
    (Bakım 3: S69 = A — SK-5 kapandı, ÇATAL kalktı; §15 C15.1.)
- **C14.3 S66 = A — carisiz evrakın karşılıksızı (SK-2 kapandı; C13.3'e ek):** `karsiliksiz {evrak, cari?, tarih?}` formdan carisiz (S49) alınan evrakta:
  - **cari seçilirse** cari borçlanır: bakiye + tutar; mizan B 120 (müşteri) | 320 (tedarikçi) (kitap G-2) / A 101|121; S49'un A 649'u YERİNDE (karardaki "(S49 geliri geri alınır)" yalnız seçilmeyen
    dalda). Tek yükümlülük kuyruğunda AYRI borç kalemi: belge günü ve vade = karşılıksız günü (S1 A "karşılıksız çıkan çek / senet" vadesiz borç → ertesi gün gecikmiş; EK-1 M1(c) A; S11 / S18
    "karşılıksız tutar ayrı borç (vadesi karşılıksız günü)"); ANINDA (4) — o gün bekleyen avans kapatır, sonraki bağsız para S2 sırasıyla; B1 gecikmişe girer (C13.5).
  - **cari seçilmezse** B 649 / A 101|121 (S49 geliri geri alınır); kimse borçlanmaz.
  - SK-2'nin `belirsiz` kaydı ve "mizan denetlenmez" kalktı. Carili evrakta `cari` verilmez (program sormaz — senaryo hatası). 2.5.0 öncesi kural setlerinde `cari` yok sayılır (eşdeğerlik).
  - C1 (2.4.9): seçilen cariye bağlanan karşılıksız evrak o carinin hareketidir (H11, C1.1 "alınan evrakın carisi").
  - Tanımsız (kâhin yazmaz): seçilen carinin `acikToplam` / `acikEsitBakiye`, görünüm toplamları ve projeksiyon toplamı — karşılıksız borcun açık kalem listelerindeki yeri kararda yok (K6.3 yalnız
    elle kayıt / Açılış, fatura, portföy evrakı sayar). Takvim / Vade Takip'te bu kalem için denetim yok.
  - Kilitli dönem: bu kâhinin dilinde dönem kilidi yalnız vade alanlarını kilitler (K6.5 (b)); kilitli dönemde alınmış evrakın kilitten sonraki karşılıksızı kümülatif mizanda aynı (senaryoda);
    kilit İÇİNDE tarihli karşılıksızın reddi (kitap G-7) ve donmuş alış maddesi defter kâhininde (`test/bagimsiz/defter` g8).

### Dil ekleri (/3, bakım 2)
`karsiliksiz {evrak, cari?, tarih?}` — carisiz evrakta programın "cari seç" sorusuna verilen yanıt; `tarih` C14.3 kaleminin günü (yoksa `bugun`). `elleCatal` SK-5 dallarını taşır. (Bakım 3: SK-5 kalktı — d10'unki `elleBeklenen`'e geçti; hiçbir senaryoda `elleCatal` kalmadı, `oz-test.py` okumayı sürdürür.)

### C8g Nasıl bozulur? (bakım 2 — önce yazıldı; senaryo karşılıkları)
| # | Bozulma | Senaryo |
|---|---|---|
| Z39 | Borç tarafında bağsız Ödeme / ciro / iade bedeli kayıt tarihine göre kapatır (2.4.5 K-b): kısa vadeli alış faturası açık kalır, uzun vadeli eski Alacak kapanır; aynı gün iade notu yerine uzun vadeli Alacak kapanır | d9 |
| Z40 | Borç tarafında tarih sırası yalnız Ödeme'de değişir, ciro / alış iadesi eski sırada kalır (iki sıra) | d9 (ciro), c12 / c8 (G3 dökümü) |
| Z41 | Vadesi geçmiş borca ileri tarihli sözde kalem "Yaklaşan", gün sayısı söze göre; kalem söz gününden kayar; tutar Kalan değil; Ödenecek Borç tarafı unutulur; vadesiz borç (S1) unutulur | d10 |
| Z42 | Söz günü / söz geçmiş / söz vadeden önce sınırında kâhin değer uydurur | d10 (ÇATAL SK-5; vadeden önceki söz kesin) |
| Z43 | Carisiz evrak karşılıksızında cari seçilse de borçlanmaz ya da 649 yerine 770 / 519; seçilen carinin borcu kuyruğa girmez (avans kapatmaz, gecikmiş sayılmaz); seçilmeyen dalda kimse borçlanır | d11 |
| Z44 | S68 düzeltmesi müşteri tarafının (S2) sırasını bozar (komşu, ders 10) | d5, d6, c6 (G3 dökümü: değişmedi) |

### C10g Mutantlar (bakım 2)
214 S68 B: borç tarafında kayıt tarihi + yazım sırası (2.4.5 K-b; bakım 1'in "B dalı") · 215 S67 B: ileri tarihli sözde kalemin durumu ve gün sayısı söz tarihine göre (K6.3) · 216 S66 B: cari seçilmezse
gider (B 770 / A 101) · 217 S66: cari seçilse de borçlanmaz (B 649 / A 101) · 218 S66: seçilen carinin karşılıksız borcu tek yükümlülük kuyruğunda kalem değil (avans kapatmaz, gecikmiş değil).

### KULLANICIYA SORULMALI (bakım 2; kâhin ÇATAL — seçilmeyen dal kanıt sayılmaz) — SK-5 YANITLANDI 06.11 13:09 UTC (S69 = A; kural §15 C15.1 — C14.2'nin SK-5 sınırının yerine)
- **SK-5 (S67 sınırı; sunum — seyrek DEĞİL: her sözün günü gelir):** vadesi geçmiş borçta Ödeme Sözü'nün günü geldiğinde (Beklenen = bugün) ve söz geçip ödeme gelmediğinde (Beklenen < bugün)
  takvim / zil kaleminin durumu ve gün sayısı ne olsun? Örnek: vade 05.06, söz 15.06 — 15.06'da **A:** "Gecikmiş, 10 gün" · **B:** "Bugün, 0 gün"; 16.06'da **A:** "Gecikmiş, 11 gün" · **B:** "Gecikmiş,
  1 gün". **A (öneri):** "ileri tarihli" vadeye göre okunur — söz vadeden sonraysa kalem söz gününde, her zaman "Gecikmiş", gün sayısı vadeden (S52 "borç gecikmiş sayılır" ve S67 ile tutarlı;
  gün sayısı söz günü sıfırlanmaz, ertesi gün geri düşmez). **B:** "ileri tarihli" bugüne göre — S67 yalnız söz yarın ve sonrası; söz günü "Bugün" (0), söz geçince bugünkü gibi sözden sayılır.

### C12g DENENMEYEN (bakım 2; neden)
- WhatsApp elemesi (S52 "Ödeme Sözü Var", S7 ailesi) — WhatsApp kâhininde / Ç5-C.
- Seçilen carinin karşılıksız borcunun takvim / Vade Takip / projeksiyon kalemi ve açık toplamları (kararda yok — yazılmaz).
- Kilit içinde tarihli karşılıksız — bu kâhinin dilinde kilit karşılıksızı denetlemez (defter kâhini g8).
- Tedarikçide alış iadesi + bağsız Ödeme + vadeli alış faturası birlikte (kaynaklar arası öncelik 2.4.9 — kararda yok; d9'da alış iadesi yok).
- Program koşulmadı (görev: CI ayrışmayı Ç5-A ile görür).

### C0g Değişen eski beklentiler (G3; bakım 1 `a5a89a1f` ↔ bakım 2 kâhin çıktısı, `2.5.0`; eski elle senaryolar + rastgele s1 / ux18 tohum 1–10 × 120) — kararla ilgisiz eski beklenti DEĞİŞMEDİ
Toplam 895 denetim satırı (elle 34, rastgele s1 861, rastgele ux18 0); dökümü kanıtta (`docs/kanit/2026-11-06/kahineski2-esdeger-cari-*`).
- **C14.1 (S68 A) — SK-4 ÇATAL → A dalı (vade sırası):** 798 (c13-ks83-ayni-gun-sira S7: `hareket:a7:kalan` 30.000, `acikToplam` −30.000, `acikEsitBakiye` true, takvim / Vade Takip /
  projeksiyon kalemi a7 ve sayaçları — 8; rastgele s1 790: alış faturası açıkları, elle Alacak / alacaklı Açılış Kalan'ları, takvim / projeksiyon kalemleri). Bakım 1'in "yalnız A dalında tanımlı
  denetimi silme"si kalktı → c13 S7'nin `takvim|vadeTakip|projeksiyon:cariToplam:S7` = −30.000 YENİDEN yazılır (3). c13 S8 a8'in dört denetiminde etiket YAYGIN → BAŞ MİMAR (değer aynı; `ks8_sinif`'in
  "aynı tarihte" nedeni 2.5.0'da düştü — C14.1). Senaryonun açıklamasındaki S7 "Alacak önce yazıldı → Alacak 0" 2.4.9 beklentisidir (2.4.9 kipinde aynen).
- **C14.2 (S67 A) — C13.6 ÇATAL → S67 değeri:** 28 (c6-cari-vade-fifo b1 / b5 — 14, d7-c5-s52-gecikmis a1 — 1, rastgele s1 13): `state` "overdue", `days` vadeden.
- **SK-5 (yeni soru) — K6.3 tek değeri → ÇATAL {K6.3, S67}:** söz GEÇMİŞ kalem 42 (c10-ks10 bh2 k1/k2/k3/k5 — 4, rastgele s1 38) + iki sorunun BİRLİKTE değdiği 19 (rastgele s1: bakım 1'de SK-4 ÇATAL'ı
  {kalem, "yok"}, şimdi SK-5 ÇATAL'ı — tutar A dalınınki) + söz BUGÜN kaleminin kural metni 1 (değer aynı ÇATAL). Bu bir ZAYIFLAMADIR (bakım 1 söz geçmiş kalemi K6.3 ile kesin bekliyordu):
  gerekçe S67 A'nın "ileri tarihli" sözünün iki okuması (§14 KULLANICIYA SORULMALI SK-5); ÇATAL'ın bir dalı bakım 1'in beklentisidir.
- **DEĞİŞMEYEN (komşu — ders 10):** müşteri tarafının sırası (C13.4 (2)–(4)), B1 gecikmiş, mizan, KG-5, kart ödenenleri; d1–d8'in `elleBeklenen`'i (d7'nin ÇATAL'ı dışında) aynen geçer; rastgele ux18
  (vadesiz) hiç değişmedi. `--kural 2.4.9` / 2.4.6 / 2.4.5 / `--legacy`: 289/289 bayt bayt aynı (üretici 20/20 aynı dizi).
- **Yeni senaryolar eski (bakım 1) kâhinde — beklenen NEDENLE farklı (ders 7, 38):** d9 27 denetim (her biri SK-4 ÇATAL'ı — ör. `fatura:AF1:acik` {0, 20.000}, `hareket:acilis:T3:kalan` {40.000, 10.000});
  d10 6 denetim C13.6 ÇATAL'ı + d1 (söz geçmiş) K6.3 tek değeri; d11 15 denetim: mizan YAZILMIYOR (SK-2 `belirsiz`), seçilen cariler borçlanmıyor (A −200 / B 400 / T 0), gecikmiş 0 / 400 / 0.

### Eşleme notları (Ç5-A / Ç5-B kod ajanı için; `kos.mjs`)
- `karsiliksiz {evrak, cari}` (carisiz evrakta cari seçimi): gövde alanı Ç5-A'da verilir — `kos.mjs` `KARSILIKSIZ_CARI` eşlemesi (verilene kadar adım GÖNDERİLMEZ, okuma hatası yazılır; sonuç yeşil
  sayılmaz). Cari seçilmeyen karşılıksız bugünkü `bounce` eşlemesiyle gider.
- **Ana oturuma:** `model.py` değişti — mobil yazma kâhininin `kabul.json`'undaki `cari_model_sha256` yeniden üretilmeli (o dosya okunmadı, değiştirilmedi).

## 15. 2.5.0 Ç5 bakımı 3 — S69 (06.11.2026; eski kâhinler bakımı 3 — kodu görmeyen AYRI el) — kural seti `2.5.0` = §13 + §14 + bu bölüm

`--kural 2.4.9` (ve 2.4.6 / 2.4.5 / `--legacy`) AYNEN — bakım 2'nin modeliyle (`d6a7b0d5`) bayt bayt eşdeğerlik kanıtta. Bu dal ana dala Ç5-A ile birlikte girer; kod tarafı Ç5-B
(iş listesi D 13:09 "İŞ ATAMASI: S69 → eski kâhinler bakımı 3 (cari) → kod Ç5-B"). Defter kâhininin dilinde takvim / zil / Ödeme Sözü yok (`test/bagimsiz/defter/KARARLAR.md` bakım 2
"S67 / S68 bu kâhinin konusu değil") → defter kâhini DEĞİŞMEDİ.

### C00h Temiz oda (bakım 3)
- **Karar metni (AYNEN; `git show 39d6c28d:docs/2.5.0-IS-LISTESI.md` D):** "KULLANICI KARARI 06.11 13:09 UTC (AYNEN: 'önerilerini uygula'; sorular C bölümünde S69–S71, öneriyle soruldu) → hepsi A:
  S69 = A: vadesi geçmiş borçta Ödeme Sözü günü gelince ve söz geçip ödeme gelmeyince takvim kalemi her zaman 'Gecikmiş', gün sayısı VADEDEN (vade 05.06, söz 15.06 → 15.06'da 10, 16.06'da 11)."
  Sorunun metni (aynı dosya, C — S69): "S69 (eski kâhinler bakımı 2 SK-5; görünüm, seyrek DEĞİL; S67'nin sınırı): vadesi geçmiş borçta Ödeme Sözü'nün günü gelince (söz = bugün) ve söz geçip
  ödeme gelmeyince takvim kaleminin durumu ve gün sayısı (örnek: vade 05.06, söz 15.06) — A öneri: her zaman 'Gecikmiş', gün sayısı VADEDEN (15.06'da 10, 16.06'da 11; S52 / S67 ile tutarlı) /
  B: söz günü 'Bugün, 0'; söz geçince sözden sayılır (16.06'da 1)." S70 / S71 bu kâhinin konusu değil (WhatsApp kâhini).
- **Okunan / okunmayan:** bakım 1–2'nin alanıyla aynı (C00f / C00g; bu sefer kural kitabı ve EK'lerden yalnız gecikmiş / vade / söz geçen bölümler — EK-1 §0 tablosu, M1(f)); tam liste ajan
  raporunda. `server/**`, `client/**`, `bulut/**`, `packaging/**`, `tools/**` (yalnız `kanit.mjs` çalıştırıldı), `docs/erp/C5-ACILIS-TASARIM.md`, `test/**` (iki kâhin klasörü dışında),
  başka ajanların `docs/kanit/**` dosyaları, git farkı / geçmiş içeriği OKUNMADI. Program koşulmadı; programın davranışı aranmadı.

### Kurallar
- **C15.1 S69 = A — söz günü ve söz geçmiş (SK-5 kapandı; C14.2'nin "SK-5 sınırı" ÇATAL'ının YERİNE):** elle kayıt / Açılış kalemi (K6.3; Kalan > 0, Beklenen Ödeme Tarihi var), vadesi
  v < bugün (v = Vade Tarihi; vadesizse v = belge günü — S1 A; vade günü gecikmiş değil — M1f) ve Beklenen > v → kalem `dueDate` = Beklenen (K6.3, "söz gününde durur" — S67),
  `state` = "overdue", `days` = v − bugün (eksi; K6.3'ün "dueDate − bugün" işaret düzeni — C14.2 ile aynı). Beklenen'in BUGÜNE göre yeri (yarın ve sonrası — C14.2 / S67; bugün; geçmiş — S69)
  sonucu DEĞİŞTİRMEZ: kural tek, ÇATAL yok. Kararın örneği: vade 05.06, söz 15.06 → 14.06'da "overdue" −9 (S67), 15.06'da −10, 16.06'da −11 (S69); gün sayısı söz günü sıfırlanmaz, söz
  geçince geri düşmez.
- **C15.2 Kesin K6.3 (S69'un DIŞI):** (a) Beklenen ≤ v (söz vadeden ÖNCE ya da vade GÜNÜ): K6.3 aynen — `dueDate` = Beklenen, durum ve gün sayısı Beklenen'e göre (bugün → "today" 0, geçmiş →
  "overdue" Beklenen − bugün, ileri → "upcoming"). Beklenen = v'de K6.3 ile C15.1 aynı değeri verir. (b) v ≥ bugün (vade bugün ya da ileride; borç vadesi geçmiş değil — M1f): K6.3 aynen.
  - **Yorum Y3-1 (ders 40; kaynak önceden yazılmış metin, programın davranışı DEĞİL):** S69'un karar cümlesi tek başına okunursa "söz vadeden önce, ikisi de geçmiş" (ör. vade 10.06, söz 05.06,
    bugün 15.06) de "vadesi geçmiş borç + söz geçmiş" sayılıp gün sayısı vadeden (−5) okunabilirdi. Bu okuma SEÇİLMEDİ: (1) soru S69 kendini "S67'nin sınırı" diye tanımlar; S67 "vadesi geçmiş
    borca İLERİ TARİHLİ Ödeme Sözü" (sözün vadeye göre ileride olduğu aile); (2) sorunun kaynağı SK-5'in A seçeneği (bakım 2, karar ÖNCESİ yazıldı) "'ileri tarihli' vadeye göre okunur —
    söz vadeden SONRAYSA kalem söz gününde, her zaman Gecikmiş, gün sayısı vadeden"; (3) C14.2 (karar öncesi) "Beklenen ≤ v iki okumada da 'ileri tarihli' değildir → K6.3 aynen (kesin)";
    (4) kararın örneği ve gerekçesi ("S52 / S67 ile tutarlı") yalnız vadeden sonraki sözü anar. Sonuç: S69 = SK-5 A, kapsamı söz > vade. Para / kapama / "kime kaç kez" kuralı değil
    (görünüm; tutar, tarih, gecikmiş değişmez) → soru değil, BAŞ MİMAR'a gösterilir.
  - **Yorum Y3-2:** "takvim kalemi" = K6.3'ün takvim / zil kalemi (aynı `/dues` kalemi; `takvim:hareket` denetimi ikisini temsil eder). İki yön (Tahsil Edilecek Borç / Ödenecek Borç) — C14.2'nin
    harfiyen yorumu (metin "vadesi geçmiş borç" yön ayırmıyor) S69'a da uygulanır; Açılış kalemi de (K6.3 "elle kayıt / açılış").
- **DEĞİŞMEYEN (komşu — ders 10):** `amount` (Kalan − Mevcut Borç kartının açık kapsamı, K6.5), `label` ("… (Ödeme Sözü)"), `direction`, `person`, `dueDate` (= Beklenen), ufuk (K6.3 söz gününe
  göre — Beklenen ≤ bugün olduğundan S69 kalemi her zaman ufukta), takvim kalem sayısı, Vade Takip ve projeksiyon satırı (`{amount, date, direction}` — durum / gün yok), B1 gecikmiş tutarı
  (C13.5: Ödeme Sözü gecikmişi DEĞİŞTİRMEZ), kapama sırası (C13.4 / C14.1 — Beklenen sırayı değiştirmez), fatura / evrak / taksit kalemleri (S69 elle kayıt / Açılış kalemine).
- **Etiket:** KULLANICI (S69 A + S67 A); carinin geçmişinde AJAN / YAYGIN nedeni varsa o (C14.2'deki düzen). SK-5 ÇATAL'ının YAYGIN etiketi kalktı.

### C8h Nasıl bozulur? (bakım 3 — önce yazıldı; senaryo karşılıkları kod commit'inde)
| # | Bozulma |
|---|---|
| Z45 | Söz günü (Beklenen = bugün) kalem "Bugün, 0" (S69 B) |
| Z46 | Söz geçince gün sayısı sözden sayılır — ertesi gün −10'dan −1'e düşer (S69 B) |
| Z47 | Söz günü sınırı kayar: S69 yalnız söz GEÇMİŞSE, söz günü K6.3 "today" 0 (ya da tersine yalnız söz günü) |
| Z48 | Söz vadeden ÖNCE iken de gün sayısı vadeden (C15.2 (a) kesin K6.3 bozulur) |
| Z49 | Gün sayısı vade ertesinden (bir gün eksik: vade 05.06, 15.06'da −9) ya da durum "overdue" iken gün sayısı söze göre |
| Z50 | Vade günü vadesi geçmiş sayılır (M1f sınırı) — vade bugün, söz ileride kalem "overdue" 0 |
| Z51 | Ödenecek Borç / Açılış / vadesiz (S1) / kısmi tahsilatlı kalem kuralın dışında kalır |
| Z52 | S69 tutarı, tarihi ya da etiketi değiştirir (`dueDate` vadeye kayar, `amount` tutar olur, "(Ödeme Sözü)" düşer); gecikmiş tutarı (C13.5) söz gününde değişir |

Senaryo karşılıkları (kod commit'i): Z45 / Z46 → d12 A (söz bugün −10), d13 A (ertesi gün −11), d10 C / D, c10 bh2; Z47 → d12 A ↔ B (mutant 220); Z48 → d12 G / F2, d13 F2 / G (mutant 221); Z49 → d12 D
(vade dün, söz bugün −1), bütün S69 kalemleri (mutant 222); Z50 → d12 V, d10 F (mutant 223); Z51 → d12 / d13 T, T2 (Ödenecek Borç), K (Açılış), E / E2 (vadesiz), H (kısmi tahsilat, Kalan 500);
Z52 → d12 / d13 `amount` / `dueDate` / `label`, `gecikmis` (16 cari), `vadeTakip` / `projeksiyon` satırları.

### Senaryolar (bakım 3)
- **`d12-c5-s69-soz-gunu-ve-gecmis`** (bugün 15.06; elle tablo, 38 beklenen): A kararın örneği (vade 05.06, söz 15.06 = bugün) −10 · B söz dün −10 · C söz geçen hafta (08.06; vade 01.06) −14 ·
  D vade dün, söz bugün −1 · E vadesiz (belge 05.06 = vade, S1) söz bugün −10 · E2 vadesiz söz geçmiş −14 · H kısmi tahsilatlı (800 − 300 = Kalan 500; vade 20.05, söz 10.06) −26 · T Ödenecek Borç
  söz bugün −21 · T2 Ödenecek Borç söz geçmiş −14 · K Açılış Bakiyesi (vade 15.05, söz 12.06) −31 — hepsi "overdue". KESİN K6.3 (C15.2): F vade = söz = bugün "today" 0 · F2 vade bugün, söz
  vadeden önce (10.06) "overdue" −5 · G söz vadeden ÖNCE, ikisi geçmiş (vade 10.06, söz 05.06) "overdue" −10 (sözden; Y3-1) · G2 söz = vade (05.06) −10 (iki okuma aynı) · E3 vadesiz belge bugün,
  söz bugün "today" 0 · V vade bugün, söz 17.06 "upcoming" +2. Ayrıca `cariKalemSayisi` 16, `hareket:h1:kalan` 50.000, `vadeTakip` a1 / t1, `projeksiyon` a1 / c1 ve 16 carinin `gecikmis`'i
  (C13.5 — sözden bağımsız; vade bugün olan F / F2 / E3 / V 0, tedarikçi 0).
- **`d13-c5-s69-soz-ertesi-gun`** (aynı adımlar, bugün 16.06): A −11 (kararın "16.06'da 11"i; S69 B'de −1) ve bütün S69 kalemleri bir gün daha geride (geri düşmez); V artık C14.2 (vade 15.06 geçti,
  söz yarın) "overdue" −1; F (söz = vade) −1 ve F2 (söz vadeden önce) −6 K6.3; gecikmiş F / F2 / E3 / V artık dolu.
- **`d10-c5-s67-soz-takvim`**: bakım 2'nin ÇATAL'ı (`elleCatal`) kalktı → `elleBeklenen`: C söz bugün "overdue" −10, D söz dün "overdue" −10 (açıklama güncellendi).
- Elle beklenenler kâhin koşulmadan yazıldı (d13'ünkü küçük bir betikle d12'den, değerler betikte elle — kanıt klasöründe `kahineski3-arac/d13-uret.py`); ilk koşuda 38 + 38 + 24 elle beklenenin
  hepsi kâhinle aynı çıktı (hiçbir elle değer kâhine göre düzeltilmedi).

### C10h Mutantlar (bakım 3; `oz-test.py` DEĞERLE — çökmeden, elle tablo kırmızı)
219 S69 B: söz günü "Bugün, 0", söz geçince sözden (K6.3) · 220 söz günü sınırı kayar: S69 yalnız söz GEÇMİŞSE (söz günü K6.3 "today" 0) · 221 söz vadeden ÖNCE iken de gün sayısı vadeden
(C15.2 (a)) · 222 gün sayısı vade ERTESİNDEN (bir gün eksik) · 223 vade günü vadesi geçmiş sayılır (M1f B; C15.2 (b) / C14.2 sınırı). Hepsi elle senaryolarda değerle yakalanır (219: d10 / d12 / d13;
220: d10 / d12; 221: d10 / d12 / d13; 222: d10 / d12 / d13 / c6; 223: d10 F / d12 V); kos.mjs düzenindeki tarama (`model.py --mutasyon-tara`, 67 dosya × kipler) 190/190.

### Öz denetim (`oz-test.py`; program AÇILMAZ)
Bakım 2'nin denetimlerine ek: her /3 senaryoda "SK-5 ÇATAL yok" ve 219–223'ün değerle yakalanması. Sayılar kanıtta (iki saat dilimi, kâhin `2da89282`; `docs/kanit/2026-11-06/kahineski3-*`):
cari öz test 572/572 · defter öz test 171/171 (defter değişmedi) · mutasyon taraması 190/190 · eşdeğerlik + G3 369/369 (üretici 20/20, eşdeğerlik 348/348, G3 84 / BEKLENMEYEN 0) — UTC ve
Europe/Istanbul aynı. KIRMIZI (ders 7, 38): bakım 2 kâhininin (`d6a7b0d5`, ayrı kopya) öz testi yeni / değişen senaryolarla 511/533 — 22 kırmızının HEPSİ d10 C / D + d12 10 + d13 10
`takvim:hareket` kalemi, kâhin değeri `{"catal": [K6.3, S67]}` (ÇATAL SK-5 — beklenen neden). Araçlar `kahineski3-arac/` (karsilastir.py, mutasyon-tara.py, d13-uret.py).

### KULLANICIYA SORULMALI (bakım 3)
YOK. S69 bu kâhinin durumlarını çözdü; Y3-1 (söz vadeden önce → K6.3) ve Y3-2 yorumdur — kaynakları yukarıda, BAŞ MİMAR'a gösterilir. Uç durumda başka iki okuma görülmedi.

### C12h DENENMEYEN (bakım 3; neden)
- Program koşulmadı (görev: CI ayrışmayı Ç5-A ile görür; kod tarafı Ç5-B). Bugünkü programın söz günü / söz geçmiş kalemi bu kâhinle ayrışabilir (K6.3 davranışı) — BEKLENEN ayrışma.
- Zil (bildirim) ekranının ayrı alanı — kâhin yalnız `/dues` kalemini (`state`, `days`) denetler (K6.3'teki gibi); zil metni / sayacı kâhinin dilinde yok.
- Mevcut Borç kartı kapsamlı caride (K6.5 (a)) söz geçmiş kalem — d12 / d13'te kart yok (tutar K6.5'ten, durum / gün C15.1'den — iki kural birbirine dokunmuyor; ayrı senaryo yazılmadı).
- Göç / eski sürüm verisindeki Beklenen alanı (K6.4 — v2.4.4 verisi gerekir; C12'deki neden aynen).
- WhatsApp elemesi (S52 "Ödeme Sözü Var") — WhatsApp kâhininde / Ç5-C.

### C0h Değişen eski beklentiler (G3; bakım 2 `d6a7b0d5` ↔ bakım 3 kâhin çıktısı, `2.5.0`; bütün elle senaryolar + rastgele s1 / ux18 tohum 1–10 × 120) — kararla ilgisiz eski beklenti DEĞİŞMEDİ
Toplam 84 değişen denetim, HEPSİ `takvim:hareket` kalemi ve HEPSİ "SK-5 ÇATAL → S69" sınıfı: eski değer {"catal": [K6.3, S67-değeri]}, yeni değer = ikinci dal (S67 / S69: "overdue", gün sayısı vadeden),
etiket YAYGIN → KULLANICI; BEKLENMEYEN 0 (dökümü kanıtta `kahineski3-esdeger-cari-*`). Senaryo senaryo:
- **Bakım 2'de SK-5 ÇATAL'ına dönen eski denetimler (42 + 19 + 1 = 62) → S69 değeri:** c10-ks10-projeksiyon-cari-vade 4 (k1 / k2 / k3 / k5 `bh2`: K6.3 dalı −3 düştü, −34 kaldı) · rastgele s1 58
  (tohum 2: 18, 4: 10, 5: 4, 6: 4, 8: 8, 9: 11, 10: 3; tohum 1 / 3 / 7 ve rastgele ux18: 0) — 57 söz geçmiş (bakım 2'nin 38'i + SK-4 ile birlikte değen 19'u) + 1 söz bugün (rastgele-s1-2 `k1:s001`
  "today" 0 → "overdue" −98).
- **Bakım 2'nin kendi senaryosu:** d10-c5-s67-soz-takvim 2 (c1 söz bugün, d1 söz dün — ÇATAL → −10 / −10).
- **Yeni senaryolar:** d12 10 + d13 10 (bakım 2 kâhininde hepsi ÇATAL SK-5 — beklenen NEDEN; öbür 28 + 28 elle beklenen bakım 2'de de aynı: K6.3 kesin kalemler, gecikmiş, Vade Takip, projeksiyon).
- **DEĞİŞMEYEN (komşu — ders 10):** C14.2 (söz yarın ve sonrası) kalemleri, K6.3 kesin kalemler (söz vadeden önce / vade günü / vade ileride), Kalan, B1 gecikmiş, mizan, Vade Takip, projeksiyon,
  kapama sırası — 84 dışında hiçbir denetim değişmedi; `belirsiz` listeleri aynı. `--kural 2.4.9` / 2.4.6 / 2.4.5 / `--legacy`: 348/348 bayt bayt aynı (elle 67 + rastgele 20 senaryo × kipler);
  üretici 20/20 aynı dizi.

### Eşleme notları (Ç5-B kod ajanı için; `kos.mjs`)
- YENİ EŞLEME YOK: `takvim:hareket` kalemi bugün de `/dues` `items[]`'ın `state` ve `days` alanından okunuyor (kos.mjs satır 206–207); S69 yalnız bu iki alanın değerini değiştirir. `kos.mjs`
  değişmedi.
- Ç5-B'nin göreceği ayrışma: söz günü (Beklenen = bugün) ve söz geçmiş (vade < Beklenen < bugün) kalemlerinde program bugün K6.3 ile "today" 0 / sözden gün sayısı veriyorsa d10 C / D, d12 (10
  kalem), d13 (10 kalem), c10 bh2 ve rastgele s1 tohum 2 / 4 / 5 / 6 / 8 / 9 / 10 kırmızı olur — S69 kod tarafı bunu kapatır.
- **Ana oturuma:** `model.py` değişti — mobil yazma kâhininin `kabul.json`'undaki `cari_model_sha256` yeniden üretilmeli (o dosya okunmadı, değiştirilmedi).

## 16. 2.5.0 Ç5 bakımı 4 — S91 / S92 / S93 (10.11.2026, `date -u`; kararlar 06.11.2026 19:33 UTC; eski kâhinler bakımı 4 — kodu görmeyen AYRI el) — kural seti `2.5.0` = §13 + §14 + §15 + bu bölüm

`--kural 2.4.9` (ve 2.4.6 / 2.4.5 / `--legacy`) AYNEN — bakım 3'ün modeliyle (`2aa1e733`) bayt bayt eşdeğerlik kanıtta. Bu dal ana dala Ç5-B / Ç5-A ile birlikte girer (ana oturum birleştirir).
Defter kâhininin (`test/bagimsiz/defter/`) dilinde takvim / zil / Vade Takip / Kalan / gecikmiş yok (kendi KARARLAR.md'si, bakım 2: "S67 / S68 bu kâhinin konusu değil") → defter kâhini DEĞİŞMEDİ.
**Bu bölümün ilk commit'i yalnız YORUMDUR (ders 40 — önce kural, sonra kod); senaryo / mutant / G3 sayıları kod ve kanıt commit'lerinde eklendi.** Commit'ler: yorum `82e65fe5` → kod +
senaryolar `a35123a8` (+ etiket inceltmesi `f49f9d97`) → kanıt araçları `e89200d7`, `a17d84f3` → kanıt (bu bölümün sayıları). Kod yazılırken yoruma eklenenler: Y4-6 ve C16.4'ün iki alt maddesi.

### C00i Temiz oda (bakım 4)
- **Karar metni (AYNEN; `git show ddd8be64:docs/2.5.0-IS-LISTESI.md` D):** "KULLANICI KARARI 06.11 19:33 UTC (AYNEN: 'önerini uygula'; sorular C'de S91–S93): S91 = A (vadesiz kayıt kayıt gününde vadeli
  kalem: takvim / zil / Vade Takip / nakit akışı), S92 = A (karar (5) net görünüm Kalan / takvim / Vade Takip'te de), S93 = A (tedarikçiye avans vadesi geçince Gecikmiş Borç; Ödeme Hatırlatma gitmez —
  Ç5-C süzer)."
- **Soruların metni (aynı dosya, C; AYNEN):**
  - "S91 (Ç5-B; PARA GÖRÜNÜMÜ, ders 43): VADESİZ kayıtlar (vadesiz Borç / Alacak Yaz, açılış, stok veresiye, karşılıksız evrak) takvim / zil / Vade Takip / nakit akışında kalem mi — A öneri (kodlanan):
    evet, kayıt gününde vadeli kalem (yaygın uygulama: vade yoksa belge tarihi; EK-1 §1 (iii), C5 §4 madde 20) — görünür sonucu vadesiz Borç Yaz ertesi gün zilde 'Tahsilat alınmadı' / B: 2.4.5 K6.3
    aynen — vadesiz borç yalnız gecikmiş toplamında ve Ödeme Hatırlatma'da."
  - "S92 (Ç5-B; PARA GÖRÜNÜMÜ, ders 43): karar (5) net görünüm Kalan / takvim / Vade Takip'e de uygulanır mı (aynı caride karşı yönlü kalemler) — A öneri (kodlanan): evet, karşı yönlü kalemler kendi
    tarihinde netleşir (C5 §2.10 madde 7; S9 = A ile aynı mantık) / B: Kalan ve takvimde iki taraf ayrı (KS2 aynen), yalnız gecikmiş netleşir. NOT: cari kâhini B'yi okuyor ve S9 örneğinde 9.000 veriyor
    (S9 = A → 4.000) — kâhin şüphesi, kâhin bakımında karar metnine göre düzeltilir."
  - "S93 (Ç5-B; PARA GÖRÜNÜMÜ): TEDARİKÇİYE verilen avans (tedarikçi bize borçlu) vadesi geçince 'Gecikmiş Borç' sayılsın mı — A öneri (kodlanan): evet (EK-1 §1: netleşmemiş her borç yönlü satır açık
    kalem); tedarikçiye Ödeme Hatırlatma gitmez (Ç5-C süzer) / B: yalnız müşteri rolündeki carilerde (denendi: kâhin c13'te vadesi geçmiş 200 gecikmişten kayboluyor)."
- **Birlikte okunan önceki kararlar (aynı dosya, D):** 05.11 ~18:55 S1 = A ("Vadesi yazılmamış bir borç (vadesiz fatura, açılış bakiyesi, vadesiz Borç Yaz, karşılıksız çıkan çek/senet, kalan varken
  kapatılan taksit kartı) ertesi günden itibaren 'gecikmiş' …" → "Evet, ertesi gün gecikmiş (vade = belge / işlem günü, TBK md. 90)"), S2 = A ("Vadesi en önce gelen"); 05.11 21:30 (1) = A ("bağsız ödeme
  kendi tarihinde (o gün dahil) açık olan borçlara S2 sırasıyla dağılır; sonradan doğan borca kaymaz, kapanmış kalem yeniden açılmaz; aynı gün önce borç kalemleri sayılır"), (2) = A ("bağ … hedefini
  her durumda kapatır"), **(5) 2B-S4 / S9 = A "Bakiyeden Netleşsin": "gecikmiş tutar carinin net borcunu aşmaz (alış faturası düşülür); bize alacaklı kişiye hatırlatma gitmez; faturaların Açık /
  Ödendi durumu yalnız Mahsup Et ile."**; 06.11 12:16 S68 = A ("… vadesi en önce gelen kalemi kapatır (S2'nin simetriği; tek yükümlülük kuyruğu iki yönde)").
- **Kararın dayandığı önceden yazılmış kural metinleri (kodu görmeyen mali müşavir; kararlardan ÖNCE):** `docs/erp/MUHASEBELESTIRME-KURAL-KITABI-EK-1.md` §1 (adım 1 borç / alacak kalemleri listesi,
  adım 4, adım 5 "gecikmiş(t) = Σ { açık borç kalemi kalanı : v < t }", adım 6 değişmezler: (i) 0 ≤ gecikmiş ≤ max(0, bakiye), (ii) Σ açık borç − Σ açık alacak = bakiye, (iii) "cari kartı = cari
  listesi = Anlık Durum = WhatsApp seçimi = Vade Takip gecikmiş tutarı"), M1(b), M1(c), M1(f); `…-EK-2B.md` madde 23 (ANINDA; "aynı gün: önce o günün borç kalemleri, sonra alacak kalemleri") ve
  **K-2 KURAL (öneri A, kâhin biçimi): "aynı carinin alış faturası (ve öteki ters yönlü kalemleri) TYK'da bağsız alacak kalemi olarak kendi belge tarihinde (madde 23 kuralıyla) satış borçlarına
  uygulanır; gecikmiş ≤ net borç; net alacaklı cariye hatırlatma gitmez. Faturaların Açık / Ödendi durumu ve 'Bu Faturayı Kapatanlar' 2.0.17 kuralıyla kalır (yalnız Mahsup Et değiştirir). Girdi:
  satış S 01.03 10.000 (vade 31.03), alış P 10.03 6.000 (vade 30.04), t = 15.04 → beklenen gecikmiş 4.000; S listede 'Açık 10.000'."** + K-2 notu ("A seçilirse Alacak Yaz da EK-1'deki gibi havuza
  girer") ve §4 2B-S4 örneği ("Alış 12.000 olsaydı (cari bize 2.000 alacaklı) → A: 0, hatırlatma yok").
- **Okunan / okunmayan:** tam liste (satır aralıklarıyla) ajan raporunda. `server/**`, `client/**`, `bulut/**`, `packaging/**`, `tools/**` (yalnız `kanit.mjs` çalıştırıldı), `docs/erp/C5-ACILIS-TASARIM.md`,
  `docs/erp/C5B-TYK-TASARIM.md` (kod planları — aynı el riski; soruların andığı "C5 §2.10 madde 7" ve "C5 §4 madde 20" bu yüzden OKUNMADI, yorum yalnız yukarıdaki metinlerden), `…-EK-2.md` (bağımsızlık
  ihlali notlu tur — bu bakımda açılmadı), `test/**` (iki kâhin klasörü dışında), başka ajanların `docs/kanit/**` dosyaları, `docs/devir/2.5.0-DEVAM/` altındaki öbür dosyalar, git farkı / geçmiş içeriği
  OKUNMADI. Program koşulmadı; programın davranışı aranmadı.

### S9 kuşkusunun sonucu (ana oturumun sorusu: "kâhin S9 örneğinde 9.000 veriyor olabilir, karar A'nın sonucu 4.000")
Bakım 3 kâhini (`2aa1e733`, ayrı kopya) koşularak ve KARAR METNİYLE karşılaştırılarak (program görülmeden) — dökümü kanıtta:
- **Kararın HARFİ örneği** (satış 10.000 vade 31.03 + alış 6.000 10.03, bugün 15.04): eski kâhin `gecikmis` = **4.000** — karar metniyle AYNI (C13.5 `min(max(0, bakiye), Σ kuyruk kalanı)` =
  min(4.000, 10.000)). "Alış 12.000" dalı da aynı (0). Kuşku bu hâliyle ÇÜRÜDÜ: harfi örnekte 9.000 çıkmıyor.
- **Aynı caride vadesi GELMEMİŞ ikinci borç varken** (yukarıdakine ek: 05.03 borç 5.000, vade 30.06): eski kâhin `gecikmis` = **9.000** (min(net borç 9.000, brüt gecikmiş 10.000)); karar metni
  (K-2 KURAL: alış kalemi "kendi belge tarihinde … satış borçlarına uygulanır" — S2 sırası: vadesi en önce gelen 31.03'lük borç; S92 "kendi tarihinde netleşir") → 10.000 − 6.000 = **4.000**.
  Kuşku bu hâliyle DOĞRULANDI: C13.5'in "yalnız net borçla sınırla" okuması kararın "alış faturası düşülür" sözünü yalnız TOPLAMDA uyguluyordu; kalem düzeyinde (hangi borçtan düşer) uygulamıyordu.
- **Kalan / takvim / Vade Takip:** eski kâhin iki tarafı ayrı gösteriyor (harfi örnekte Borç Kalan 10.000 "Tahsil Edilecek" + Alacak Kalan 6.000 — KS2 / C13.4 (9)); S92 = A → net (4.000 / 0).
- Düzeltme: C16.2 ve C16.4.

### Kurallar
- **C16.1 S91 = A — vadesiz kayıt kayıt gününde vadeli kalemdir (K6.3'ün "Vade ya da Beklenen Ödeme Tarihi'li" koşulunun YERİNE):** Kalan > 0 olan her elle kayıt (Borç / Alacak Yaz) ve Açılış
  takvim / zil kalemidir; `dueDate` = Beklenen Ödeme Tarihi varsa o, yoksa Vade Tarihi, **o da yoksa kaydın günü (belge tarihi; Açılış'ta carinin açılış günü)**. Durum ve gün sayısı K6.3 aynen
  (`dueDate − bugün`): kayıt günü "today" 0, ertesi gün "overdue" −1 (M1f: vade günü gecikmiş değil; S1: ertesi gün gecikmiş). Ufuk (KS5), yetki, "Ödendi Say" yok, tutar = Kalan (K6.5 kart kapsamı
  düşülür) — K6.3 aynen. Vade Takip aynı kalemi `{amount, date, direction}` gösterir; Nakit Akış Projeksiyonu (KS10 — kararın "nakit akışı"sı) kalemi kayıt gününde (pencere ve gecikenler K-P1 aynen).
  Söz kuralları (C14.2 / C15.1 / C15.2) değişmez — vadesiz kayıtta v zaten belge günüydü.
  - **Yorum Y4-1 (ders 40):** karar "vadeli kalemdir" diyor → kalem K6.3 kalemidir: etiket "Tahsil Edilecek Borç" / "Ödenecek Borç" (+ " (Ödeme Sözü)") AYNEN; kararın "zilde 'Tahsilat alınmadı'"
    sözü zilin gecikmiş "in" kalemindeki metnidir (zil metni kâhinin dilinde yok — C12h). Saklanan alan DEĞİŞMEZ: `hareket:<ad>:vade` boş kalır (K6.2; karar görünümler için, kayıt düzenlenmiyor).
  - **Yorum Y4-2:** "stok veresiye" = dildeki tek açık hesap stok çıkışı (KS7.1 `stok_satis_hesap`); "karşılıksız evrak" = C14.3'ün AYRI borç kalemi (formdan carisiz evrakın karşılıksızında seçilen
    cari — günü karşılıksız günü). Carili evrakın karşılıksızı bu kâhinde ayrı kalem değil, kapatıcının kalkmasıdır (S8 A / C13.4 (8): kapattığı kalemler kendi vadeleriyle açılır) — değişmedi.
    Bu iki kalem türü için programdaki kalem kimliği bilinmiyor → kalem başına anahtar YOK; kâhin onları carinin görünüm toplamlarında (`takvim | vadeTakip | projeksiyon:cariToplam:<cari>` — K6.5 (1) /
    KS10 "Σ kalemler = bakiye") ve `gecikmis`'te denetler. C14.3'ün "karşılıksız borcun görünümdeki yeri kararda yok" tanımsızlığı görünüm toplamları için KALKTI (yer: karşılıksız günü).
  - Sayaçlar (`takvim:cariKalemSayisi`, `projeksiyon:cari`): elle kayıt / Açılış kalemleri kesin; penceredeki stok veresiye / karşılıksız kalemi ve netleşmemiş avans satırı (C16.3, SK-7) "cari
    kaynaklı kalem" sayılıp sayılmayacağı bilinmeyen üyelerdir → sayaç ÇATAL {n … n + belirsiz üye}, etiket YAYGIN.
  - KS10 "bir kez" (K-P2): vadesiz kayıt artık tarihli kalem olduğundan temiz caride `projeksiyon:cariToplam` = bakiye denetimi vadesiz kayıtlı cariye de yazılır ("Faturasız Cari Alacağı" satırıyla
    çift sayım bekçisi; etiket YAYGIN aynen).
- **C16.2 S92 = A — net görünüm: aynı caride karşı yönlü kalemler kendi tarihinde netleşir (C13.4 (9) "iki taraf AYRI" ve 2.4.5 KS2'nin Kalan / takvim / Vade Takip için YERİNE):**
  1. **Karşı yönlü kalemler:** borç yönlü yükümlülük kalemleri (satış faturası, elle Borç, borçlu Açılış, stok veresiye, karşılıksız borç kalemi, taksitler) ↔ alacak yönlü yükümlülük kalemleri (alış
     faturası, elle Alacak, alacaklı Açılış). Her kalem, karşı yönün açık kalemlerine **kendi BELGE tarihinde** bağsız kalem gibi uygulanır (K-2 KURAL "kendi belge tarihinde (madde 23 kuralıyla)"):
     o gün açık olan karşı kalemler S2 / S68 sırasıyla (vade → belge → yazım) kapanır; artan açık kalır ve sonra doğan karşı kaleme doğduğu gün uygulanır; kapanmış kalem yeniden açılmaz ((1) A).
     Bağlar önce ((2) A): faturaya bağlı tahsilat / evrak / ödeme hedefini zamandan bağımsız kapatır — bağla kapanan kısım netleşmeye girmez.
  2. **Net olan görünümler:** elle kaydın / Açılış'ın **Kalan**'ı (`hareket:<ad>:kalan`); takvim / zil, Vade Takip ve (KS10 "tutar = Kalan / takvimdeki tutar" gereği) projeksiyon kalemlerinin tutarı —
     elle kayıt, Açılış VE fatura kalemleri (`takvim | vadeTakip | projeksiyon:fatura:<ad>`); görünüm toplamları.
  3. **Net OLMAYAN:** faturanın belge durumu `fatura:<ad>:acik` — (5) "faturaların Açık / Ödendi durumu yalnız Mahsup Et ile"; K-2 "S listede 'Açık 10.000'". Kendi tarafının kuralıyla (C13.4 / C14.1)
     hesaplanmaya devam eder. Bakiye, Kasa, mizan değişmez.
  - **Yorum Y4-3:** fatura kalemlerinin takvim / Vade Takip tutarının da net olması S92 "takvim / Vade Takip'te de" + EK-1 §1 (iii) "Vade Takip gecikmiş tutarı = B1" + kararın kendi örneğinden
    (satış + alış FATURASI → 4.000). Belge durumu ayrı kalır (madde 3).
  - **Yorum Y4-4:** netleşme günü karşı kalemin BELGE tarihidir, vadesi değil — K-2 örneğinde alışın vadesi 30.04, bugün 15.04 ve sonuç 4.000 (vadesi gelmemiş alış düşülmüş); EK-2B'nin "yalnız
    vadesi gelmiş alış borcumuz düşer" ara çözümü "önerilmedi". Zamandan bağımsız (bütün karşı kalemler önce) okuma da değil: (1) A "kendi tarihinde … kapanmış kalem yeniden açılmaz".
  - **Tanım alanı (kâhin değer UYDURMAZ):** net görünüm yalnız "yalın" caride kurulur — satır türleri: taksitsiz satış / alış faturası, elle Borç / Alacak, Açılış, stok veresiye, karşılıksız borç
    kalemi, tahsilat / alınan evrak (bağlı ya da bağsız), Ödeme / ciro (bağlı ya da bağsız), geri ödeme / geri tahsilat etkileşimi olmayan faturasız stok Satış İadesi / Alış İadesi. Taksit kartı,
    taksitli fatura, fatura iadesi, şüpheli / değersiz, KS8 / KS9 geri ödeme etkileşimi olan caride karşı yönlü kalem VARSA net görünüm denetimleri YAZILMAZ (`belirsiz`'e yazılır; `fatura:acik`,
    bakiye, mizan, Kasa yazılmaya devam eder). Karşı yönlü kalemi OLMAYAN caride (tek yönde yükümlülük) §13–§15 aynen.
  - **Okuma birliği (ders 40 / 43 — iki okuma kalan yerde kâhin susar):** yalın caride sonuç şu okumaların HEPSİNDE aynıysa yazılır, ayrışırsa o carinin net görünüm denetimleri yazılmaz
    (`belirsiz`; SK-6 / SK-8): (a) tek aşama (karşı kalem zaman çizelgesinde bağsız kalemdir — K-2 harfiyen) ↔ iki aşama (bağsız ödeme önce kendi tarafının kalemini kapatır, netleşme kalanlar
    arasında); (b) aynı gün sırası: önce o günün yükümlülük kalemleri (iki yönde) sonra ödemeler ↔ önce borç tarafı (borç kalemleri, tahsilatlar) sonra alacak tarafı (alacak kalemleri,
    ödemelerimiz) ↔ tersi; (c) gelen satırın karşısında hem yükümlülük kalemi hem netleşmemiş ödeme (avans) satırı açıksa öncelik: hepsi vade sırasında ↔ önce yükümlülükler ↔ önce avans
    satırları. 2 × 3 × 3 = 18 okuma (`model.py` `net250`). Aynı birlik karşı yönlü kalemi OLMAYAN yalın caride de aranır (verilen avans satırı + açık borç kalemi + sonradan tahsilat — SK-8 (b)):
    ayrışırsa o carinin Kalan / takvim / gecikmiş denetimleri de yazılmaz.
  - **Yorum Y4-6 (kod yazılırken; programa bakılmadan — ders 40):** (b)'nin üç okuması da KENDİ tarafının kuralını korur ((1) A "aynı gün önce borç kalemleri sayılır" ve S68 simetriği "önce
    o günün kalemleri, sonra bizim ödememiz" — §13 / §14'te iki taraf böyle kuruluydu). İlk yorum commit'inde yazdığım "önce bütün borç yönlü, sonra bütün alacak yönlü satırlar (madde 23
    harfiyen)" okuması tedarikçi tarafında bizim ödememizi o günün alış faturasından ÖNCE işletir ve kalemleri vade yerine yazım sırasıyla kapatır — S68 = A ile çelişir → okuma sayılmadı.
- **C16.3 S93 = A — netleşmemiş borç yönlü ödeme satırı (verilen avans) açık kalemdir:** cariye yaptığımız bağsız Ödeme / ciro (ve bağlı ödemenin hedefini aşan kısmı) karşı yönde kalem
  kapatmadıysa açık borç yönlü kalemdir; günü ve vadesi ödeme günü (vadesiz kayıt — S1 / S91) → **ertesi günden** B1 gecikmiş tutarına girer. Cari türüne bakılmaz (tedarikçi dahil — kararın B'si
  "yalnız müşteri rolündeki carilerde" idi). Sonradan doğan alacak yönlü kalem (ör. sonradan gelen alış faturası) avansı doğduğu gün kapatır (C14.1 / ANINDA — değişmedi).
  - **Yorum Y4-5:** karar metni "tedarikçiye verilen avans"ı soruyor; gerekçesi "EK-1 §1: netleşmemiş her borç yönlü satır açık kalem" tür ayırmıyor → müşteriye yapılan netleşmemiş Ödeme de aynı
    kuralla sayılır (EK-1 §1 adım 1 "müşteriye para iadesi (T-09)" borç kalemidir). Ödeme Hatırlatma'nın tedarikçiye gitmemesi WhatsApp kâhininin / Ç5-C'nin işi — bu kâhinin konusu DEĞİL.
  - Avans satırının takvim / zil / Vade Takip / projeksiyonda AYRI KALEM olup olmadığı kararda yok (S91'in listesi avansı saymıyor; S93 yalnız "Gecikmiş Borç sayılır" diyor; EK-1 §1 (iii) ise
    kalem olmasını gerektirir) → kâhin avans satırı için kalem denetimi YAZMAZ, sayaçlar ÇATAL (C16.1), o carinin görünüm toplamı yazılmaz (Σ kalemler ≠ bakiye) — **SK-7**.
- **C16.4 B1 gecikmiş tutarı (C13.5'in formülünün YERİNE; S9 kuşkusu):** `<k>:cari:<ad>:gecikmis` = **Σ { net kuyrukta açık borç yönlü kalemin kalanı : vade < bugün }** (EK-1 §1 adım 5) — borç
  yönlü yükümlülük kalemlerinin NET kalanı (C16.2) + netleşmemiş borç yönlü ödeme satırları (C16.3). `min(max(0, bakiye), …)` sınırı formülden KALKTI: net kuyrukta (i) kendiliğinden sağlanır
  (Σ açık borç − Σ açık alacak = bakiye, (ii)); kâhin (ii)'yi tutturamadığı caride (karşı yönde açık satır kalıyor ve cari yalın değil) `gecikmis` YAZMAZ. Ödeme Sözü gecikmişi değiştirmez (S52),
  vade günü gecikmiş değil (M1f), vadesiz kalem ertesi gün (S1), kart alttaki borcu tüketir (M1e) — C13.5 aynen. Şüpheli kaydı olan cari tanımsız (aynen).
  - Yalın caride iki yönlü tek kuyruktan (okuma birliğiyle); yalın olmayan, karşı yönlü kalemi de olmayan caride (taksit kartı, iade …) kendi tarafının kuyruğu + verilen avans satırları.
  - AÇIK ALIŞ İADESİ NOTU (tedarikçinin bize iade bedeli borcu; KS9) açıkken `gecikmis` YAZILMAZ: S93 "verilen avans"ı soruyor, iade alacağımız için karar metni yok (kâhin uydurmaz; DENENMEYEN).

### C8i Nasıl bozulur? (bakım 4 — önce yazıldı; senaryo karşılıkları kod commit'inde)
| # | Bozulma |
|---|---|
| Z53 | Vadesiz Borç / Alacak Yaz ve Açılış takvimde / Vade Takip'te / projeksiyonda kalem değil (S91 B — K6.3 aynen) |
| Z54 | Vadesiz kalemin günü kayıt gününün ERTESİ (kayıt günü kalem yok ya da ertesi gün "Bugün"); ya da kayıt günü "Gecikmiş" (sınır kayması) |
| Z55 | Stok veresiye / karşılıksız borç kalemi görünüm toplamına girmez (yalnız elle kayıt); vadesiz kalem "Faturasız Cari Alacağı" ile projeksiyonda iki kez |
| Z56 | S91 saklanan Vade alanını doldurur ya da kapama sırasını / gecikmişi değiştirir (komşu — ders 10) |
| Z57 | Kalan / takvim / Vade Takip'te iki taraf ayrı kalır (S92 B — KS2), yalnız gecikmiş netleşir |
| Z58 | Gecikmiş yalnız net borçla sınırlanır (eski C13.5): vadesi gelmemiş ikinci borç varken 9.000 (karar 4.000) |
| Z59 | Karşı kalem VADESİNDE netleşir (vadesi gelmemiş alış düşülmez) ya da zamandan bağımsız netleşir (önce tahsil edilmiş borca sonradan gelen Alacak yine "mahsup" olur, tahsilat avansa döner) |
| Z60 | Netleşme S2 sırasını izlemez (uzun vadeli borçtan düşer) ya da kapanmış kalemi yeniden açar |
| Z61 | Faturanın belge durumu (Açık / Ödendi) da netleşir ((5) "yalnız Mahsup Et ile" bozulur); ya da fatura kalemi takvimde brüt kalır |
| Z62 | Aynı adlı iki carinin karşı yönlü kalemleri birbirine netleşir |
| Z63 | Tedarikçiye avans gecikmiş sayılmaz (S93 B) ya da ödeme GÜNÜ gecikmiş sayılır; sonradan gelen alış faturası avansı kapatmaz |
| Z64 | Net görünümün tanımsız olduğu caride (kartlı / iadeli çapraz cari; okumaların ayrıştığı sıra) kâhin değer uydurur |

Senaryo karşılıkları (kod commit'i): Z53 → d14 / d15 A, B, B2, K, KA, P (mutant 224) · Z54 → d14 A "today" 0 ↔ d15 A "overdue" −1 (mutant 225); gecikmişte d14 A 0 ↔ d15 A 700, S2, Q2
(mutant 211) · Z55 → d14 / d15 S, S2, Q, Q2 görünüm toplamları (mutant 232); `projeksiyon:cariToplam` A / K (K-P2 bekçisi) · Z56 → d14 `hareket:a1:vade` "", V (vadeli komşu), P (kısmi
tahsilat), R (S8 — borç kendi günüyle) · Z57 → d16 M1, M2, M5 (mutant 226) · Z58 → d16 M3 (mutant 227), M7 · Z59 → d16 M1 (vadesi gelmemiş Alacak düşülür — mutant 228), M6 (mutant 229) ·
Z60 → d16 M7 (S2 sırası — mutant 206), M6 (kapanmış borç yeniden açılmaz), M11 (artan sonra doğan kaleme) · Z61 → d16 M2 `fatura:FS:acik` 10.000 ↔ `takvim:fatura:FS` 4.000 (mutant 233),
M10, T1 · Z62 → d16 M9a / M9b, d14 B / B2, d17 TA1 / TA2 · Z63 → d17 T, TS, TK, TG; d17 TB 0 ↔ d18 TB 400 (mutantlar 230, 231) · Z64 → d19 N1–N6 (`elleYok`, `elleBelirsiz`).

### Senaryolar (bakım 4; elle tablolar — toplam 286 elle denetim)
- **`d14-c5-s91-vadesiz-kayit-gunu`** (bugün 15.06; 70 elle denetim): A vadesiz Borç BUGÜN "today" 0, gecikmiş 0 · B vadesiz Borç dün −1, gecikmiş 500 · B2 AYNI ADLI ikinci cari, vadesiz Alacak
  "Ödenecek Borç" −1 · K vadesiz borçlu Açılış −5 · KA tedarikçi vadesiz alacaklı Açılış "Ödenecek Borç" −3 · S / S2 stok veresiye (dün / bugün) görünüm toplamı = bakiye, gecikmiş 450 / 0 ·
  Q / Q2 formdan carisiz çekin karşılıksızı (cari seçildi; dün / bugün) toplam = bakiye, gecikmiş 600 / 0 · P kısmi tahsilatlı vadesiz Borç (Kalan 500) −14 · Z tamamı tahsil edilmiş → kalem
  yok · V vadeli Borç (komşu: "upcoming" +5, saklanan vade dolu) · R carili bağsız çekle kapanan vadesiz Borç, çek karşılıksız → borç KENDİ günüyle (01.06) kalem −14, gecikmiş 500 (S8) ·
  saklanan Vade alanı boş (Y4-1) · sayaçlar ÇATAL 8…12 (8 elle kayıt / Açılış kalemi kesin + 4 stok veresiye / karşılıksız kalemi belirsiz üye).
- **`d15-c5-s91-vadesiz-ertesi-gun`** (aynı adımlar, bugün 16.06 — GÜN DÖNÜMÜ; 39): A "overdue" −1 ve gecikmiş 700; S2 250, Q2 350 gecikmiş; öbürleri bir gün daha geride; kalem günleri değişmez.
- **`d16-c5-s92-net-gorunum`** (bugün 15.04; 81): M1 kararın harfi örneği (elle) Kalan 4.000 / 0, gecikmiş 4.000 · M2 aynı örnek FATURALARLA (takvim / Vade Takip fatura kalemi 4.000, alış kalemi
  yok; belge durumu 10.000 / 6.000) · M3 S9 kuşkusu (+ vadesi gelmemiş 5.000 → gecikmiş 4.000; eski 9.000) · M4 alış 12.000 dalı (gecikmiş 0, "Ödenecek Borç" 2.000) · M5 5.000 + 1.000 iade
  borcu → net 4.000 · M6 tarih farklı (önce tahsil edilen borç, sonra gelen Alacak açık kalır) · M7 S2 sırası (kısa vadeli borç önce; gecikmiş 0) · M11 artan sonra doğan karşı kaleme · M9a /
  M9b aynı adlı iki cari · M10 bağ önce (bağlı tahsilatla kapanan satış netleşmeye girmez) · T1 tedarikçide stok veresiye alış + Alacak ile netleşir · sayaçlar 9 / 9.
- **`d17-c5-s93-verilen-avans`** (bugün 15.06; 37): T alış 300 + Ödeme 500 → avans 200 gecikmiş · TB avans BUGÜN → 0 · TS avans, sonradan gelen alış kısmen kapatır → 100 · TK tamamen kapatır →
  0 · TG bağ fazlası 150 · TA1 / TA2 aynı adlı iki tedarikçi (600 / 0) · MU müşteriye netleşmemiş Ödeme 100 (vadesi gelmemiş Borç sayılmaz) · MA müşterinin bize avansı → 0 · TR avans geri
  alındı → 0 · avanslı carinin görünüm toplamı ve avans satırının kalemi YOK (`elleYok`; SK-7) · sayaçlar ÇATAL 0…6 / 1…7.
- **`d18-c5-s93-avans-ertesi-gun`** (aynı adımlar, bugün 16.06 — GÜN DÖNÜMÜ; 12): TB gecikmiş 400; öbürleri aynı.
- **`d19-c5-s92-okuma-ayrisan`** (bugün 15.04; 47 — 11 beklenen + 29 `elleYok` + 7 `elleBelirsiz`): kâhinin SUSTUĞU durumlar — N1 / N2 / N3 SK-6 (elle ve faturalı; belge durumu ve saklanan
  alanlar yazılır), N4 tanım alanı dışı (Mevcut Borç kartlı caride karşı yönlü kalem), N5 SK-8 (a) aynı gün, N6 SK-8 (b) tek yönde avans + borç + tahsilat.
- Elle beklenenler kâhin koşulmadan yazıldı; ilk koşuda 286 elle denetimin HEPSİ kâhinle aynı çıktı (hiçbir elle değer kâhine göre düzeltilmedi).

### C10i Mutantlar (bakım 4; `oz-test.py` DEĞERLE — çökmeden, elle tablo kırmızı)
224 S91 B: vadesiz kayıt kalem değil (K6.3 aynen) → d14 / d15 · 225 S91 sınırı: vadesiz kalemin günü kayıt gününün ertesi → d14 / d15 · 226 S92 B: Kalan / takvim / Vade Takip iki taraf ayrı
(KS2), yalnız gecikmiş net → d16 · 227 S9 / C13.5 eski okuma: gecikmiş = min(net borç, brüt gecikmiş) → d16 M3 / M7, d17 / d18 · 228 S92 sınırı: karşı kalemler vadelerinde netleşir → d16 M1 ·
229 S92 sınırı: karşı kalemler zamandan bağımsız, ödemelerden önce netleşir → d16 M6 · 230 S93 B: tedarikçi türündeki caride gecikmiş yok → d11 T, d17, d18 · 231 S93 sınırı: avans ödeme
günü gecikmiş → d17 TB · 232 S91: stok veresiye / karşılıksız kalemi görünüm toplamında yok → d14 / d15 S · 233 (5) B: faturanın belge durumu da netleşir → d16 M2. Eski mutantlar 206 / 207 /
214 iki yönlü kuyrukta da uygulanır (sıra / HAVUZ); kos.mjs düzenindeki tarama (`model.py --mutasyon-tara`, 73 dosya × kipler) 200/200.

### KULLANICIYA SORULMALI (bakım 4; kâhin bu durumlarda SUSAR — denetim yazmaz; ders 43, SORU DÜZENİ)
- **SK-6 (S92 × netleşmeden SONRA gelen bağsız ödeme; PARA GÖRÜNÜMÜ / kime ne tutarla hatırlatma — ders 43, 45):** aynı kişi hem müşteri hem tedarikçi; satış borcu ile bizim alış borcumuz net
  görünümde birbirine sayıldıktan sonra taraflardan biri kendi borcunu AYRICA, bağlamadan öderse? Örnek 1: 01.03 satış 10.000 (vade 31.03) · 10.03 alış 6.000 · 12.03 biz alış borcumuzu 6.000
  ödedik. Örnek 2: 01.06 Borç 1.000 · 03.06 Alacak 300 · 05.06 müşteri 800 ödedi.
  **A:** netleşme geri alınmaz (K-2 / madde 23 harfiyen "kapanmış kalem yeniden açılmaz"): Örnek 1'de satış 4.000 (vade 31.03) + ödediğimiz 6.000 ayrı açık kalem, 13.03'ten itibaren "Gecikmiş
  Borç 6.000" (satışın vadesi gelmeden hatırlatma gider); Örnek 2'de Borç 0, Alacak 0, müşterinin 100 avansı.
  **B (öneri):** bağsız ödeme önce KENDİ tarafının kalemini kapatır (belge durumuyla aynı resim: alış "Ödendi"), netleşme kalanlar arasında: Örnek 1'de satış 10.000 vade 31.03 — 31.03'e kadar
  gecikmiş 0, sonra 10.000; Örnek 2'de Borç 0, Alacak 100 açık ("Ödenecek Borç 100"). Gerekçe: Kalan / takvim, fatura listesindeki Açık / Ödendi ile çelişmez; vadesi gelmemiş satış için
  hatırlatma gitmez.
  **C:** uç durum böyle kalsın (BİLİNEN SINIR). Kâhin: iki okuma ayrıştığında o carinin net görünüm denetimlerini yazmaz.
- **SK-7 (S93 / S91 × avans satırı; GÖRÜNÜM):** tedarikçiye (ya da müşteriye) verilen, karşılığı gelmemiş avans (netleşmemiş Ödeme satırı) takvim / zil / Vade Takip / nakit akışında AYRI KALEM
  olarak görünsün mü? **A (öneri):** evet — "Tahsil Edilecek Borç" kalemi, ödeme gününde vadeli (gecikmiş tutarı her ekranda aynı — EK-1 §1 (iii); S91'in "vadesiz kayıt kayıt gününde vadeli
  kalemdir" sözüyle tutarlı). **B:** hayır — yalnız cari kartındaki "Gecikmiş Borç" toplamında (S91'in listesi harfiyen). **C:** uç durum böyle kalsın (BİLİNEN SINIR). Not: müşterinin bize verdiği
  avansın (netleşmemiş tahsilat) "Ödenecek Borç" kalemi OLMADIĞINI kâhin bugünkü gibi bekliyor (bunu değiştiren karar metni yok; program farklıysa önce hata — ders 6).
- **SK-8 (S92 sıra ayrıntıları; UÇ DURUM):** (a) aynı GÜN hem karşı yönlü kalem hem ödeme varsa sıra (örnek: aynı gün Borç 1.000, Alacak 300, tahsilat 1.000) — **A (öneri):** önce o günün
  kalemleri (iki yönde) netleşir, sonra o günün ödemeleri ((1) "aynı gün önce borç kalemleri sayılır"ın iki yönlü hâli; örnekte Alacak 0 + müşterinin 300 avansı) / **B:** her taraf önce kendi
  içinde — o günün tahsilatı önce o günün borç kalemini kapatır, karşı yönlü kalem kalanla netleşir (örnekte Alacak 300 açık; SK-6 B ile aynı yön) / **C:** uç durum böyle kalsın (BİLİNEN SINIR).
  (b) Gelen tahsilatın karşısında hem açık borç kalemi hem netleşmemiş avans satırı varsa önce hangisi (örnek: 01.03 müşteriye Ödeme 200 · 05.03 Borç 100 (vade 30.04) · 10.03 tahsilat 150) —
  **A (öneri):** avans satırı da kalemdir, vade (= ödeme günü) sırasına girer (S93 ilkesi; örnekte avans 50 + Borç 100 açık) / **B:** önce yükümlülük kalemleri (örnekte Borç 0, avans 150) /
  **C:** uç durum böyle kalsın (BİLİNEN SINIR). Kâhin: okumalar ayrıştığında susar (d19 N5, N6).

### Dil ekleri (/3, bakım 4)
Yeni adım / yeni çıktı anahtarı YOK. Senaryo dosyasında yalnız `oz-test.py`'nin okuduğu `elleBelirsiz`: kâhinin sustuğu durumun `belirsiz` kaydında geçmesi gereken parçalar (liste = aynı
kayıtta hepsi). Yeni `belirsiz` kayıtları: "cari <ad> net görünüm tanımsız (2.5.0 C16.2): …", "cari <ad> gecikmiş tutarı tanımsız (2.5.0 C16.4): …".

### Öz denetim (`oz-test.py`; program AÇILMAZ)
Bakım 3'ün denetimlerine ek: `elleBelirsiz`; mutantlar 224–233 DEĞERLE; iki yönlü tek kuyruğun `model.py`'den AYRI yazılmış saf simülasyonuyla (`saf_net`: tek aşama, gün içinde önce kalemler
sonra ödemeler, karşı satırlar vade → belge → yazım) çapraz denetimi — modelin okuma birliği bulduğu yalın caride net kalanlar ve verilen avans satırları bire bir; karşı yönlü kalemi
olmayan yalın caride iki yönlü kuyruk = kendi tarafının kuyruğu (§13–§15 değişmedi); net kuyrukta (ii) Σ açık borç yönlü − Σ açık alacak yönlü = bakiye ve tek yön açık; yazılan her
gecikmişte (i) 0 ≤ gecikmiş ≤ max(0, bakiye). Senaryolar: elle /3 (son üç kontrol kesimi) + rastgele s1 tohum 1–8 × 60. Sayılar ve geniş tarama (s1 tohum 1–30 × 120, her kontrol
kesimi) kanıtta — aşağıda "Kanıt".

### C12i DENENMEYEN (bakım 4; neden)
- Program koşulmadı (görev: programla karşılaştırmayı ana oturum Ç5-B sınamasında yapar). Programın SK-6 / SK-7 / SK-8 durumlarındaki davranışı bilinmiyor — kâhin o durumlarda susuyor.
- Karşı yönlü kalemli caride taksit kartı / taksitli fatura / fatura iadesi / şüpheli / değersiz / KS8 – KS9 geri ödeme etkileşimi: net görünüm kurulmadı (tanım alanı dışı; `belirsiz`).
  Rastgele s1'in tedarikçisi S (alış + Alacak + stok veresiye + Alış İadesi + geri tahsilat) çoğu kontrolde bu sınıfta — G3'te "kalkan" denetimlerin kaynağı.
- Avans satırının takvim / zil / Vade Takip / projeksiyon KALEMİ (SK-7) ve müşterinin bize verdiği avansın "Ödenecek Borç" kalemi olup olmadığı; açık alış iadesi notunun (tedarikçinin iade
  bedeli borcu) gecikmişe girip girmediği (karar metni yok — `gecikmis` yazılmaz).
- Stok veresiye ve karşılıksız borç kalemi için KALEM başına denetim (programdaki kalem kimliği bilinmiyor — yalnız görünüm toplamı ve gecikmiş); bu kalemlerin etiketi / durumu / gün sayısı.
- İLERİ tarihli vadesiz kayıt (kayıt günü bugünden sonra — ufuk dışı kalem): senaryo yazılmadı (programın ileri tarihli Borç Yaz'ı kabul edip etmediği bilinmiyor; kural aynı: gün = kayıt günü).
- Zil (bildirim) metni ('Tahsilat alınmadı') — kâhin yalnız `/dues` kalemini denetler (C12h aynen). WhatsApp elemesi (tedarikçiye Ödeme Hatırlatma gitmez) — WhatsApp kâhini / Ç5-C.
- Faturanın VADESİ bu kâhinin dilinde yok (fatura kalemi belge gününde — [YAYGIN], değişmedi): kararın örneğindeki "satış vade 31.03" elle Borç ile (d16 M1), faturalı hâli vadesiz (M2).
- Mahsup Et (dilde yok): karşı yönlü kalemler Mahsup Et'le kapatıldıktan sonra net görünüm ve belge durumu.

### C0i Değişen eski beklentiler (G3; bakım 3 `2aa1e733` ↔ bakım 4 kâhin çıktısı, `2.5.0`; 67 eski elle senaryo + rastgele s1 / ux18 tohum 1–10 × 120) — kararla ilgisiz eski beklenti DEĞİŞMEDİ
Toplam 3.112 denetim satırı (eski 44.071 → yeni 41.771 denetim); her satır o KONTROL anındaki durumdan sınıflandı, **BEKLENMEYEN 0** (dökümü `docs/kanit/2026-11-06/kahineski4-g3-dokum.json`,
özet `kahineski4-esdeger-cari-*.log`). Sınıflar: **S91** vadesiz kayıt kalem oldu — 393 değişen ("yok" → kalem) + 23 yeni (`projeksiyon:cariToplam`: vadesiz kayıtlı temiz caride K-P2 bekçisi) ·
**S92-net** karşı yönlü kalemli yalın caride net görünüm — 251 değişen · **S92-tanımsız** karşı yönlü kalemli ama tanım alanı dışı / okumaları ayrışan caride net görünüm denetimi KALKTI —
2.163 (bir ZAYIFLAMADIR: bakım 3 bu denetimleri "iki taraf ayrı" (KS2) okumasıyla yazıyordu; S92 = A o okumayı kaldırdı, yerine tek okumayla konabilecek değer yok — C16.2 tanım alanı,
SK-6 / SK-8) · **sayaç** (türev: `takvim:cariKalemSayisi`, `projeksiyon:cari`) — 122 değişen (yeni kalem / ÇATAL belirsiz üye) + 160 kalkan (aynı kontrolde tanımsız cari). Senaryo senaryo:
- **c10-ks10-projeksiyon-cari-vade:** S91 3 (bg5 vadesiz Borç 100, 03.06 — takvim / Vade Takip / projeksiyon "yok" → kalem) + sayaç 2 (2 → 3, 8 → 9).
- **c6-cari-vade-fifo:** S91 6 (b3 vadesiz Borç 200, iki kontrol) + sayaç 4. **c7b-supheli-kalan:** S91 6 (`acilis:D` vadesiz Açılış 2.500) + sayaç 4. **d2-c5-kg5-excel-kart:** S91 6
  (`acilis:L`) + sayaç 4. **d9-c5-s68-borc-tarafi-vade:** S91 3 (al6 vadesiz Alacak 100 — "Ödenecek Borç" kalemi) + sayaç 2.
- **c14a-c1-hareket-turleri:** S91 27 + 9 yeni (a-ha vadesiz Alacak, `acilis:HAC`, b-hb × üç kontrol; `projeksiyon:cariToplam` HA / HAC / HB) + sayaç 6 (0 → ÇATAL 3…6: üç kalem kesin, üç belirsiz
  üye). **c14b:** S91 3 + 1 yeni + sayaç 2. **c14d:** S91 9 + 3 yeni + sayaç 6. **c14e:** S91 9 + 3 yeni + sayaç 6 (ÇATAL 1…2).
- **d1-c5-acilis-519:** S91 15 + 5 yeni (A–E vadesiz Açılışlar; B alacaklı Açılış "Ödenecek Borç") + sayaç 2 (0 → 5).
- **d7-c5-s52-gecikmis:** S91 3 + 1 yeni (b1 vadesiz Borç 500) + **S92-net 5** (D: Borç 800 ↔ Alacak 600 → Kalan 200 / 0, takvim / Vade Takip / projeksiyon 800 → 200; **gecikmiş 200 AYNI**) + sayaç 2.
- **c6b-cari-vade-dogrulama:** S92-net 16 (E: ea Alacak 150 ↔ eb Borç 400 → Kalan 0 / 250; "Ödenecek Borç" kalemi kalktı, "Tahsil Edilecek" 400 → 250; iki kontrol) + sayaç 4 (5 → 4).
- **c7-ks7-bagsiz-kapaticilar:** S92-net 5 (tedarikçi S, k6: stok veresiye 450 alış F2 400 + Alacak a1 300 ile netleşir → a1 Kalan 300 → 250, `takvim:fatura:F2` 400 → yok; belge durumu F2 Açık
  400 AYNEN). Senaryonun açıklamasındaki "fatura 400 ve Alacak 300 AÇIK" bakım 3'e kadarki (KS7.1 + KS2) beklentidir — belge durumu için hâlâ doğru, Kalan / takvim için S92 ile değişti.
- **c8-ks8-iade-geri-odemesi:** S92-net 5 (E, k1 — iade ve Ödeme'den ÖNCE: satış FE1 500 + elle Alacak ae1 300 → FE1 takvim kalemi 500 → 200, ae1 Kalan 300 → 0) + S92-tanımsız 25 kalkan (sonraki
  kontroller: aynı caride iade + Ödeme — KS8 etkileşimi) + sayaç 2 değişen, 10 kalkan.
- **c12-ks81-sb-kalan-dagilimi:** S92-tanımsız 20 kalkan (B4: k1'de Borç 200 + Alacak 150 netleştikten sonra stok iadesi 300 — okumalar ayrışıyor (SK-6); k2'de + Ödeme — KS8) + sayaç 4 kalkan.
- **c13-ks83-ayni-gun-sira:** S92-tanımsız 60 kalkan (S1 / S2 / S3 / S6: satış + elle Alacak + stok iadesi + Ödeme — KS8 etkileşimi; S9: alış + Alış İadesi + elle Borç + Tahsilat — KS9) + sayaç 2
  kalkan. `fatura:*:acik` (belge durumu), bakiye, adım durumları AYNEN yazılıyor.
- **d11-c5-s66-carisiz-karsiliksiz:** sayaç 2 (0 → ÇATAL 0…3: üç karşılıksız borç kalemi belirsiz üye). Gecikmiş değerleri AYNI.
- **rastgele s1 tohum 1–10:** S91 303 + 1 yeni · S92-net 220 · S92-tanımsız 2.058 kalkan (tedarikçi S: alış + Alacak + alacaklı Açılış + stok veresiye çoğu kontrolde Alış İadesi + geri tahsilatla
  birlikte — KS9; kalanı okuma ayrışması) · sayaç 74 değişen + 144 kalkan. **rastgele ux18 tohum 1–10:** 0.
- **DEĞİŞMEYEN (komşu — ders 10):** hiçbir eski senaryoda `gecikmis` değeri değişmedi (d4, d7, d8, d10–d13); `fatura:*:acik` (belge durumu), bakiye, mizan, Kasa, kart ödenenleri, adım durumları, söz
  kuralları (C14.2 / C15), tek yönde yükümlülüğü olan carilerin Kalan'ları — 3.112 dışında hiçbir denetim değişmedi; eski senaryoların `elleBeklenen`'lerinin HEPSİ aynen geçiyor (hiçbiri
  düzeltilmedi). Değeri aynı kalıp yalnız etiketi değişen 573 denetim: karşı yönlü kalemli yalın caride Kalan / takvim / Vade Takip / projeksiyon kalemi BAŞ MİMAR → KULLANICI (S92 A; ikisi de
  BULGU sınıfı). `--kural 2.4.9` / 2.4.6 / 2.4.5 / `--legacy`: 348/348 bayt bayt aynı (67 elle + 20 rastgele senaryo × 4 kip); üretici 20/20 aynı dizi.
- **Yeni senaryolar eski (bakım 3) kâhinde — beklenen NEDENLE kırmızı (ders 7, 38):** 286 elle denetimin 142'si: d14 35 + d15 21 (vadesiz kalem "yok", görünüm toplamı yazılmıyor, sayaç 1) ·
  d16 40 (iki taraf ayrı Kalan / takvim; M3 gecikmiş 9.000, M7 gecikmiş 400) · d17 7 + d18 7 (avans gecikmiş 0) · d19 32 (eski kâhin tanımsız durumlara değer yazıyor, `belirsiz` kaydı yok).
  Kalan 144'ü iki kâhinde aynı (bakiye, belge durumu, vadeli komşular, kapalı kalemler, değişmeyen gecikmişler).

### Kanıt (bakım 4; iki saat dilimi — UTC ve Europe/Istanbul çıktıları bayt bayt aynı; kâhin `f49f9d97`, temiz ağaç; `docs/kanit/2026-11-06/kahineski4-*`, araçlar `kahineski4-arac/`)
cari öz test **2.478/2.478** (`-cari-oz-*`: elle tablolar + mutantlar 200–233 + saf TYK 170 kalem + bakım 4 çapraz denetimi: saf net 68 kalem karşı yönlü kalemli caride, 495 kalem tek yönde,
avans 205 cari, (ii) 256 cari, gecikmiş (i) 337 cari) · defter öz test **171/171** (`-defter-oz-*`; defter DEĞİŞMEDİ) · mutasyon taraması **200/200** (`-cari-mutasyon-*`; kos.mjs düzeni, 73 dosya
× kipler) · eşdeğerlik + G3 **369/369** (`-esdeger-cari-*`: üretici 20/20, eşdeğerlik 348/348, G3 3.112 / BEKLENMEYEN 0) · yeni elle tablolar yeni kâhinde **286/286** (`-elle-yeni-cari-*`) ·
ESKİ kâhinde (`2aa1e733`, ayrı kopya) aynı tablolar **142 kırmızı** / 286 (`-kirmizi-eski-cari-*`; her kırmızının eski değeri dökümde) · S9 dökümü: eski kâhin 7/20 değer karar metniyle aynı
(13 farklı — `-s9-eski-*`), yeni kâhin 20/20 (`-s9-yeni-*`) · geniş tarama **1.545/1.545** (`-genis-tarama-*`: s1 tohum 1–30 × 120, 390 kontrol kesimi — saf net 481 + 516 kalem, tek yön =
kendi tarafı 1.750 kalem, (ii) 379, gecikmiş (i) 479; susulan: okuma ayrışan 41, tanım alanı dışı 190 cari-kesim). Araçlar: `karsilastir.py` (eşdeğerlik + G3 sınıflama),
`elle-karsilastir.py`, `mutasyon-tara.py`, `genis-tarama.py`, `s9-yokla.py`. Mutasyon ve geniş tarama `flock -s …/olcum.lock` ile koşuldu (ders 52).

### Eşleme notları (Ç5-B kod ajanı / ana oturum için; `kos.mjs`)
- YENİ ANAHTAR YOK, YENİ ADIM YOK, YENİ EŞLEME YOK: bütün denetimler bugünkü anahtarlardan (`hareket:*:kalan`, `takvim | vadeTakip | projeksiyon:hareket | fatura | cariToplam`,
  `takvim:cariKalemSayisi`, `projeksiyon:cari`, `cari:*:gecikmis`, `cari:*:acikToplam`). `kos.mjs` DEĞİŞMEDİ (okunan satırlar: 1–58 başlık, 150–275 `kontrolV3` okumaları, 398–479 adım
  gövdeleri, 760–937 `kontrol` okumaları, 1186–1230 mutasyon taraması — yalnız alan / olay eşlemesi için).
- `GECIKMIS_ALAN` (C13.5 notu) ve `KARSILIKSIZ_CARI` (C14.3 notu) hâlâ `null`: d14 / d15'in Q, Q2 adımları (`karsiliksiz {cari}`) ve bütün `gecikmis` denetimleri bu eşlemeler verilince okunur.
- Program görünümlerinde stok veresiye / karşılıksız kalemi `source: "account"` (ya da `account|…` kimliği) taşıyorsa sayaç ÇATAL'ın üst dalına, taşımıyorsa alt dalına düşer — ikisi de geçer;
  verilen avans satırı kalem olarak geliyorsa (SK-7 A) yine ÇATAL içinde kalır, ama o carinin `cariToplam`'ı kâhinde yazılmadığı için denetlenmez.
- `acikToplam` karşı yönlü kalemli caride KARIŞIK toplamdır (faturanın belge açığı + elle kaydın NET Kalan'ı — koşucunun okuduğu aynı karışım); `acikEsitBakiye` bu yüzden false olabilir (d16 T1).
- **Ana oturuma:** `model.py` değişti — mobil yazma kâhininin `kabul.json`'undaki `cari_model_sha256` yeniden üretilmeli (o dosya okunmadı, değiştirilmedi).

## 17. 2.5.0 Ç5 bakımı 5 — S95 / S96 / S97 / S98 (10.11.2026, `date -u` 13:43, sürdürme 17:42; kararlar 10.11.2026 13:20 UTC; eski kâhinler bakımı 5 — kodu görmeyen AYRI el) — kural seti `2.5.0` = §13 + §14 + §15 + §16 + bu bölüm

`--kural 2.4.9` (ve 2.4.6 / 2.4.5 / `--legacy`) AYNEN — bakım 4'ün modeliyle (`14e3f4bb`) bayt bayt eşdeğerlik kanıtta. Defter kâhini (`test/bagimsiz/defter/`) DEĞİŞMEZ (dilinde takvim / Kalan /
gecikmiş yok — §16 aynen). **Bu bölümün ilk commit'i yalnız YORUMDUR (ders 40 — önce kural, sonra kod); senaryo / mutant / G3 sayıları kod ve kanıt commit'lerinde eklenir.**

### C00j Temiz oda (bakım 5)
- **Karar metni (AYNEN; `git show f2d152c1:docs/2.5.0-IS-LISTESI.md` D):** "KULLANICI KARARI 10.11 13:20 UTC (AYNEN: 'önerilerini uygula'; sorular C'de S95–S98): S95 = A — karşı yönlü kalemler
  netleştikten sonra gelen BAĞSIZ ödeme önce KENDİ tarafının kalemini kapatır, netleşme kalanlar arasında (örnek: satış 10.000 vade 31.03 kalır, alış 'Ödendi', 31.03'e kadar gecikmiş 0; kâhinde
  SK-6 B okuması). S96 = A — verilen, karşılığı gelmemiş avans takvim / zil / Vade Takip / nakit akışında AYRI KALEM ('Tahsil Edilecek Borç', ödeme gününde vadeli). S97 = A — aynı gün önce o
  günün kalemleri (iki yönde) netleşir, sonra o günün ödemeleri. S98 = A — avans da kalemdir, vade (= ödeme günü) sırasına girer. UYGULAMA: cari kâhini bakımı 5 (…)"
- **Soruların metni (aynı dosya, C; AYNEN, seçenekler):**
  - S95: "aynı kişi hem müşteri hem tedarikçi; karşı yönlü kalemler net görünümde birbirine sayıldıktan SONRA taraflardan biri kendi borcunu ayrıca, bağlamadan öderse. Örnek: 01.03 satış 10.000
    (vade 31.03) · 10.03 alış 6.000 · 12.03 biz alış borcumuzu 6.000 ödedik — A öneri (kâhinde SK-6 B): ödeme önce KENDİ tarafının kalemini kapatır (alış 'Ödendi'), satış 10.000 vade 31.03, o
    güne kadar gecikmiş 0 / B (kâhinde SK-6 A): netleşme geri alınmaz — satış 4.000 + ödediğimiz 6.000 ayrı açık kalem, 13.03'ten 'Gecikmiş Borç 6.000' / C: uç durum böyle kalsın".
  - S96: "tedarikçiye / müşteriye verilen, karşılığı gelmemiş avans takvim / zil / Vade Takip / nakit akışında AYRI KALEM olsun mu — A öneri: evet ('Tahsil Edilecek Borç', ödeme gününde vadeli;
    gecikmiş tutarı her ekranda aynı) / B: hayır, yalnız cari kartındaki 'Gecikmiş Borç' toplamında / C: uç durum böyle kalsın".
  - S97: "aynı GÜN hem karşı yönlü kalem hem ödeme varsa sıra (örnek: aynı gün Borç 1.000, Alacak 300, tahsilat 1.000) — A öneri: önce o günün kalemleri netleşir, sonra ödemeler (Alacak 0 +
    müşterinin 300 avansı) / B: her taraf önce kendi içinde (Alacak 300 açık) / C: uç durum böyle kalsın".
  - S98: "gelen tahsilatın karşısında hem açık borç kalemi hem netleşmemiş avans varsa önce hangisi (örnek: 01.03 müşteriye Ödeme 200 · 05.03 Borç 100 vade 30.04 · 10.03 tahsilat 150) — A öneri:
    avans da kalemdir, vade (= ödeme günü) sırasına girer (avans 50 + Borç 100 açık) / B: önce yükümlülük kalemleri (Borç 0, avans 150) / C: uç durum böyle kalsın".
- **Birlikte okunan:** §16'nın kaynakları AYNEN (S1, S2, (1), (2), (5), S68, S91–S93, EK-1 §1, EK-2B 23 ve K-2) + "BAŞ MİMAR KARARI 10.11 13:19" (bakım 4 yorumları Y4-1 … Y4-6 KABUL; S9
  kuşkusu C16.4; "BİLİNEN ZAYIFLAMA … S95–S98 yanıtlanınca sonraki kâhin bakımında geri kazanılır").
- **Okunan / okunmayan:** tam liste (satır aralıklarıyla) ajan raporunda. Görev metninin yasakları aynen (`server/**`, `client/**`, `bulut/**`, `packaging/**`, `tools/**` — yalnız `kanit.mjs`
  çalıştırılır —, `docs/erp/C5-ACILIS-TASARIM.md`, `docs/erp/C5B-TYK-TASARIM.md`, `docs/devir/**`, iki kâhin klasörü dışındaki `test/**`, başka ajanların `docs/kanit/**` dosyaları, git farkı /
  geçmiş içeriği). İş listesi satırlarında programdan söz eden parçalar var (S91–S93'te "(kodlanan)", S93'te "denendi: kâhin c13'te …") — KULLANILMADI; hiçbir kural bunlardan türetilmedi.
  Program koşulmadı; programın davranışı aranmadı. f2d152c1'den SONRAKİ kararlar (ör. 10.11 13:27 sonrası) bu bakımın kapsamında DEĞİL (görev metni) — kullanılmadı.

### Yorumlar (ders 40 — karar metinlerinden; kod yazılmadan ÖNCE; baş mimar kullanıcıya gösterir)
- **Y5-1 — S95 ile S97 birlikte: bakım 4'ün 18 okumasından HİÇBİRİ dört kararın örneklerini birlikte vermiyor.** Bakım 4'ün "iki aşama"sı (bağsız ödeme ÖNCE ve ZAMANDAN BAĞIMSIZ yalnız kendi
  tarafının YÜKÜMLÜLÜK kalemlerini kapatır, sonra netleşme kalanlar arasında) S95'in örneğini veriyor (satış 10.000), ama S97'nin örneğinde S97 B'nin sonucunu (Alacak 300 açık) ve S98'in örneğinde
  S98 B'nin sonucunu (Borç 0, avans 150) veriyor; "tek aşama" S97 ve S98'in örneklerini veriyor, S95'inkini vermiyor (satış 4.000 + avans 6.000 = S95 B). Kullanıcı dört sorunun A'sını,
  her birinin örnek sonucuyla seçti → kararların birlikte okunuşu şudur (dört örneğin dördünü de veren okuma; kâhin bunu uygular):
  **(a) Gün sırası (S97 A):** her günde önce o günün yükümlülük kalemleri (iki yönde; kendi aralarında yazım sırasıyla — ders 31) gelir ve o anda açık karşı satırlara uygulanır (netleşme — K-2
  "kendi belge tarihinde"), sonra o günün bağsız ödemeleri (yazım sırasıyla).
  **(b) Bağsız ödeme önce kendi tarafını kapatır (S95 A):** "kendi tarafı" = ödemenin kapattığı yöndeki satırlar (tahsilat için carinin borç yönlü kalemleri + verilen avans — S98; bizim ödememiz
  için alacak yönlü kalemler + alınan avans — sırası Y5-3). Bir kalemin ÖNCEKİ GÜNLERDE karşı yönlü bir KALEMLE netleşmiş kısmı ödemeye açıktır (netleşme geri alınır, karşı kalem yeniden açılır,
  "netleşme kalanlar arasında" yeniden kurulur); ÖDEMENİN KENDİ GÜNÜNDE (o günün kalemleriyle — (a)) netleşmiş kısmı açık DEĞİLDİR (S97 A'nın örneği: aynı gün Borç 1.000, Alacak 300, tahsilat
  1.000 → Alacak 0 + müşterinin 300 avansı). Ödemenin artanı avanstır (S93 / S96 / S98).
  **Sonuç (baş mimara gösterilmeli — S95 ile S97'nin birleşiminden doğan sıçrama):** aynı örnekte tahsilat ERTESİ GÜN gelirse (01.06 Borç 1.000 + Alacak 300, 02.06 tahsilat 1.000) S95 uygulanır:
  Borç 0, **Alacak 300 açık ("Ödenecek Borç 300")**, avans yok; aynı gün gelirse S97: Alacak 0 + müşterinin avansı 300. Bakiye ikisinde de −300; değişen yalnız görünüm (takvim / Vade Takip
  kalemi). Kâhin bunu karar metinlerinin harfi sayar (S97'nin örneği aynı gün durumu için açık sayı veriyor; S97 B "her taraf önce kendi içinde" — ki S95'in aynı güne uygulanışıdır — seçilmedi).
- **Y5-2 — S98 A'nın kapsamı:** verilen avans (netleşmemiş borç yönlü ödeme satırı: Ödeme, ciro, bağlı ödemenin hedefini aşan kısmı) borç yönlü bir KALEMDİR: ona karşı gelen HER alacak yönlü
  satır (tahsilat, alınan evrak, faturasız stok iadesi, bağ fazlası, alış faturası, elle Alacak, alacaklı Açılış) borç yönlü kalemleri ve avansı TEK vade sırasıyla (vade → belge günü → yazım;
  avansın vadesi ve belge günü ödeme günü) kapatır — net görünümde (Kalan / takvim / Vade Takip / projeksiyon / gecikmiş) ve karşı yönlü kalemi OLMAYAN carinin Kalan'ında da (S98'in örneğinde
  "Borç 100 açık" bir elle kaydın Kalan'ıdır). **Faturanın BELGE durumu (`fatura:acik`):** S98'in örneği elle Borç; belge durumunun da avansı kalem sayan kuyruktan mı yoksa §13'ün tek taraflı
  kuyruğundan mı geldiği bu dört kararın metninde açık değil ((5) "belge durumu yalnız Mahsup Et ile" karşı yönlü KALEMLER içindir) → verilen avans açıkken sonra bağsız alacak yönlü satır gelen
  caride kâhin satış faturasının belge durumunu YAZMAZ (`belirsiz`; önceki bakımlar yazıyordu — G3'te "kalkan"). Bu bir ZAYIFLAMADIR; sonraki karar gelince geri kazanılır.
- **Y5-3 — S98'in kapsamadığı: ALINAN avans (müşterinin bize fazla ödemesi; netleşmemiş alacak yönlü ödeme satırı).** S98 sorusu ve örneği yalnız verilen avans içindir; S96 da alınan avansı
  kalem saymaz (bakım 4 SK-7 notu "değişmedi"). Bizim ödememizin (ya da yeni borç yönlü kalemin) karşısında hem açık alacak yönlü kalem hem alınan avans açıksa önce hangisi — kararda yok →
  üç okuma (hepsi vade sırasında / önce yükümlülükler / önce avans satırları); ayrışırsa kâhin o caride susar (**SK-11**).
- **Y5-4 — (b)'nin iki biçimi ve verilen avansın kapanışı (uç durumlar):** (b) iki biçimde yazılabiliyor: **K1** "netleşme bir görünümdür" — her ödemede açık tutar hesaplanır, netleşme sonunda
  kalanlar arasında zaman sırasıyla YENİDEN kurulur; **K2** "netleşme kayıtlıdır" — ödeme önceki günlerin netleşmesini en yeniden başlayarak geri alır, açılan karşı kalem kalanlarla netleşir.
  Bir kalemin iki farklı günde iki karşı kalemle netleştiği ve ödemenin bunlardan birinin günüyle aynı gün geldiği durumda hangi karşı kalemin açılacağı ayrışır (**SK-9**). Ayrıca verilen avansın
  sonradan gelen alacak yönlü kalemle kapanması (ANINDA — (1) A "kapanmış kalem yeniden açılmaz") S95'in "netleşme"si mi (sonraki bağsız ödemeyle geri alınır) yoksa ödemenin kapaması mı (kesin)
  — S98 "avans da kalemdir" diyor, (1) A kapamayı kesin sayıyor → iki okuma (**SK-10**). Kâhin bu okumaların HEPSİNİ hesaplar; ayrışırsa o caride susar (`belirsiz`), birleşirse yazar.
- **Y5-5 — faturasız stok Satış İadesi / Alış İadesi (KS7.1 bağsız kapatıcı) ve bağ fazlaları S95'in "bağsız ödeme"si gibi işler:** §13 C13.4 (4) bunları bağsız tahsilatla aynı aileye koydu
  ("bağsız alacak … faturasız stok Satış İadesi … bağ fazlaları"), §16 C16.2 (1) yükümlülük kalemi saymadı → S95 / S97 / S98 bunlara da uygulanır. Bağsız kaynakların BİRBİRİNE önceliği §13
  C13.4 (10) AYNEN (kaynaklar arası öncelik kararda yok — 2.4.9 korundu); yalnız bir alacak yönlü satırın karşısında faturasız Alış İadesi alacağımız (açık iade notu) ile verilen avans /
  borç yönlü kalem birlikte açıksa önce hangisi (C13.4 (10) "alış iadesi önce" ↔ S98 "vade sırası") iki okuma (**SK-12**).
- **Y5-6 — S96 A'nın kalemi:** avans kalemi = netleşmemiş verilen avansın NET kalanı; etiket "Tahsil Edilecek Borç", yön "in", `dueDate` = ödeme günü, durum / gün sayısı K6.3 (ödeme günü
  "today" 0, ertesi gün "overdue" −1 — C16.3 "ertesi günden gecikmiş" ile aynı sınır), ufuk K6.3 / KS5, Vade Takip ve Nakit Akış Projeksiyonu (KS10, K-P1 pencere) aynı kalem. Anahtar
  (programdaki kalem kimliği bilinmiyor — kâhin, avans bir cari hareketinden (Ödeme) doğduğu için elle kaydın kalemiyle aynı biçimi bekler): `takvim | vadeTakip | projeksiyon:hareket:<ödeme
  adımı>`. Avansı kalmamış (kalem kapatmış) Ödeme'nin kalemi YOK ("yok"); silinmiş Ödeme "yok". Ciro avansının (evraktan doğar) kalem başına anahtarı yok — sayaçta belirsiz üye, görünüm
  toplamına girer. Faturasız Alış İadesi alacağımız (açık iade notu) S96'nın "avans"ı DEĞİL — kalem olup olmadığı ve gecikmişi kararda yok (§16 aynen; kâhin susar). Müşterinin bize verdiği
  avans kalem değil (bakım 4 notu aynen; S96 değiştirmedi). Sayaçlar: Ödeme avansı kesin üye, ciro avansı / stok veresiye / karşılıksız kalemi belirsiz üye (C16.1 aynen). Avanslı carinin
  görünüm toplamı (Σ kalemler = bakiye) artık yazılır.
- **Y5-7 — tanım alanı (değişmedi):** taksit kartı, taksitli fatura, fatura iadesi, şüpheli / değersiz, KS8 / KS9 etkileşimi, kart tahsilatı, tabloya bağlı cari, iki yönde faturasız iade → karşı
  yönlü kalem varsa net görünüm YAZILMAZ (§16 aynen; S95–S98 bunlar için yeni kural getirmedi). Bu "yalın olmayan" carilerde tek taraflı kuyruk sürer; ama S98 orada da geçerli olduğundan
  verilen avans açıkken o günden sonra bağsız alacak yönlü satır gelmişse (tek taraflı kuyruk avansı kalem saymıyor) o carinin Kalan / belge durumu / gecikmiş / avans kalemi YAZILMAZ.
  Açık alış iadesi notu (gecikmiş) §16 aynen yazılmaz.

### KULLANICIYA SORULMALI (bakım 5; kâhin bu durumlarda SUSAR — ders 43, SORU DÜZENİ; hepsi UÇ DURUM)
- **SK-9 (Y5-4 K1 ↔ K2):** bir borç kalemi iki ayrı günde iki karşı kalemle netleşmişken ödeme bunlardan sonrakinin GÜNÜNDE gelirse hangi karşı kalem açılır? Örnek: 01.06 Borç 1.000 · 02.06
  Alacak X 300 · 03.06 Alacak Y 300 + aynı gün tahsilat 1.000. **A (öneri):** Y'nin aynı gün netleşmesi kalır (S97), önceki günün X'i açılır: X 300 açık, Y 0, müşterinin avansı 300 / **B:**
  netleşme kalanlar arasında tarih sırasıyla yeniden kurulur: X 0, Y 300 açık, avans 300 / **C:** uç durum böyle kalsın (BİLİNEN SINIR).
- **SK-10 (Y5-4 avans kapanışı):** tedarikçiye avans verdik, sonra alış faturası avansı kısmen kapattı, sonra tedarikçi avansın TAMAMINI geri ödedi. Örnek: 01.03 Ödeme 500 · 05.03 alış 300 ·
  10.03 tedarikçiden tahsilat 500. **A (öneri):** avansın alışla kapanması kesin ((1) A): alış "Ödendi", tedarikçinin fazla 300'ü bize avansı (kalem değil) / **B:** S95 gibi geri alınır: avans
  kapanır, alış 300 açık ("Ödenecek Borç 300") / **C:** uç durum böyle kalsın (BİLİNEN SINIR).
- **SK-11 (Y5-3 alınan avans):** müşterinin bize fazla ödemesi (avans) duruyorken ona karşı borcumuz (Alacak) da varsa, bağlamadan yaptığımız Ödeme önce hangisini kapatır? Örnek: 01.03 tahsilat
  500 (borcu yok) · 05.03 Alacak 200 (vade 30.04) · 10.03 Ödeme 300. **A (öneri):** S98'in simetriği — vade sırası (avans 01.03 önce): avans 200 kalır, Alacak 200 açık / **B:** önce yükümlülük:
  Alacak kapanır, avans 400 / **C:** uç durum böyle kalsın (BİLİNEN SINIR).
- **SK-12 (Y5-5 açık alış iadesi alacağımız ↔ verilen avans):** tedarikçide hem faturasız Alış İadesi alacağımız hem verilen avansımız açıkken yeni alış faturası gelirse önce hangisinden düşülür?
  Örnek: 01.03 Ödeme 300 (avans) · 05.03 Alış İadesi 200 · 10.03 alış 250. **A (öneri):** C13.4 (10) aynen — önce alış iadesi: iade alacağı 0, avans 250 (gecikmiş / takvim avansla) / **B:**
  vade sırası (avans 01.03 önce): avans 50, iade alacağı 200 / **C:** uç durum böyle kalsın (BİLİNEN SINIR).
- **SK-13 (Y5-2 belge durumu × S98):** müşteriye avans verilmişken (Ödeme) sonra gelen bağlamadan tahsilat önce avansı kapatıyor (S98); bu caride bağsız SATIŞ FATURASININ listedeki Açık / Ödendi
  durumu da bu sırayla mı? Örnek: 01.03 Ödeme 200 · 05.03 satış faturası 100 · 10.03 tahsilat 150. **A (öneri):** evet — fatura "Açık 100", avans 50 (cari kartı, takvim ve fatura listesi aynı
  resmi gösterir) / **B:** hayır — fatura listesi §13'ün tek taraflı kuyruğuyla: fatura "Ödendi", avans 150 (takvim ile fatura listesi ayrışır) / **C:** uç durum böyle kalsın (BİLİNEN SINIR).
  (f2d152c1'den sonraki bir karar bunu yanıtladıysa — görev metni gereği okunmadı — sonraki bakım işler.)

### Kurallar (kod commit'i; yorumların `model.py`'deki karşılığı)
- **C17.1 (Y5-1) iki yönlü tek kuyruk — `net250` bakım 4'ün 18 okumasının YERİNE:** olaylar `_olay5` (gün → önce o günün yükümlülük kalemleri, sonra ödeme satırları → yazım sırası);
  kalem gelince açık karşı satırlara `_oncelik5` sırasıyla uygulanır (`_akis5`; iki kalem → "net", alacak yönlü kalem ↔ verilen avans → "avans", ödemenin kapaması → "kap"); bağsız
  ödeme satırı kendi tarafının (karşı yönlü) satırlarını kapatır — açık kısım + ÖNCEKİ günde "net" uygulanmış kısım (`_geri5`: gün < ödeme günü; SK-10 B okumasında "avans" da). İki
  biçim: **K2** `_k2_5` (defter; en yeni netleşme önce geri alınır, açılan karşı kalem ödeme bitince kalanlarla netleşir) ve **K1** `_k1_5` (her ödemede önceki olaylarla görünüm, en sonda
  çizelge kalanlarla yeniden). Bağlar önce, satır kümesi `_net_satirlar` AYNEN (bakım 4).
- **C17.2 (Y5-2 / Y5-3 / Y5-5) sıra:** gelen alacak yönlü satır → borç yönlü kalemler ve verilen avans TEK vade sırası (v → belge → yazım; avansta v = belge = ödeme günü) — S98 A;
  açık alış iadesi alacağımız (borç yönlü 'd') SK-12 okumasıyla ('vade' | 'iade-once'). Gelen borç yönlü satır → alacak yönlü kalemler ve alınan avans SK-11 okumasıyla ('s2' |
  'yukumluluk' | 'odeme'; ödeme satırları arasında C13.4 (10) havuzu).
- **C17.3 okuma birliği (`_okumalar5`):** {K2, K1} × {avans-kesin, avans-geri} × {vade, iade-once} × {s2, yukumluluk, odeme}; bir boyut yalnız o caride sonucu değiştirebiliyorsa açılır
  (satır türlerine göre — ör. karşı yönlü kalem + ödeme yoksa yalnız K2). Okumalar ayrışırsa o carinin net görünümü (Kalan, takvim, Vade Takip, projeksiyon, gecikmiş, açık toplam, görünüm
  toplamı, avans kalemi) YAZILMAZ (`belirsiz`: "okumalar ayrışıyor (…) — KULLANICIYA SORULMALI SK-9 … SK-12"). Yazılan her değer dört kararın örneğini veren bütün okumaların ortak sonucudur.
- **C17.4 net_durum:** karşı yönlü kalemli yalın cari → "net" (birlik varsa); karşı yönlü kalemsiz yalın cari → iki yönlü kuyruk kendi tarafının kuyruğuyla AYNIYSA "tek" (etiket / metin
  §13–§15 aynen), değilse "net" + `kaynak: S98` (verilen avans kalem — Y5-2); yalın olmayan cari → karşı yönlü kalem varsa "tanimsiz" (§16 aynen), yoksa `_s98_dis` (Y5-7) "tanimsiz",
  değilse "tek".
- **C17.5 faturanın belge durumu (`belge_tanimsiz`, Y5-2 / SK-13):** yalın caride aynı okumalar İKİ KALEM NETLEŞMEDEN (`yy=False`) koşulur; hepsi §13 tek taraflı kuyrukla aynıysa
  `fatura:*:acik` yazılır (değişmeyen durum), değilse yazılmaz (`belirsiz`: "fatura belge durumu tanımsız (2.5.0 C17)"); `acikToplam` da. Yalın olmayan caride `_s98_iki` ikinci sonucu.
- **C17.6 Y5-7 koruması (`_s98_iki`):** yalın olmayan caride verilen avans sonrası bağsız alacak yönlü satır — müşteri türünde (alacak yönlü kalem yok; avans = son durumdaki artan, KS8.2)
  o satır tek taraflı kuyrukta vadesi avansın gününe eşit / sonra bir kalemi kapattıysa (sıra değişir: Kalan + belge durumu) ya da artanı kaldıysa (avansa giderdi: Kalan / gecikmiş / avans
  kalemi) yazılmaz; tedarikçi türünde o satırın gününe kadarki bağsız borç tarafı kaynakları alacak yönlü kalemleri aşıyorsa (avans açık olabilir) ikisi de yazılmaz.
- **C17.7 S96 kalemi (Y5-6):** `kontrol_v3` Ödeme hareketinde `avans_kalemi` (yalın: net kuyruğun avans satırı; yalın olmayan: tek taraflı borç tarafının artanı — `bagfazla:` /
  `gerifazla:` dahil) → `takvim:hareket:<ödeme>` {amount, dueDate = ödeme günü, direction "in", label "Tahsil Edilecek Borç", state / days K6.3, cari, person} ya da "yok";
  `vadeTakip:hareket:<ödeme>` (ufkun içi ya da "yok"), `projeksiyon:hareket:<ödeme>` (KS10 penceresi; geçmiş günlü kalem YAYGIN — K-P1). Tanımsız caride (None) kalem ve sayaç yazılmaz.
  Sayaçlar: Ödeme avansı kesin üye (hareket döngüsünde), ciro avansı / açık alış iadesi alacağı / stok veresiye / karşılıksız kalemi belirsiz üye; net görünümü tanımsız ya da C13.4 (11)
  tanımsız caride kalem olabilecek satır (Ödeme, ciro, stok veresiye, karşılıksız) varsa sayaç yazılmaz (bakım 4'te bu cariler sayaçtan sessizce atlanıyordu — kâhin düzeltmesi, ders 6).
  Görünüm toplamı (`_cari_kalemleri`): verilen avans kalemi ödeme gününde girer; açık alış iadesi alacağı (iade notu / borç yönlü 'd') varsa tanımsız.
- `--kural 2.4.9` / 2.4.6 / 2.4.5 / `--legacy`: hiçbir yol değişmedi (bütün yeni dallar `k250`).

### C8j Nasıl bozulur? (bakım 5 — kod commit'inde, senaryolarla birlikte yazıldı)
| # | Bozulma | Senaryo |
|---|---|---|
| Z65 | Netleşme geri alınmaz (S95 B): sonradan gelen ödeme netleşmiş kalanı kapatır, artanı avans | d20 P1 / P2 / P3, d19 N1 / N2 (mutant 234) |
| Z66 | Ödemenin GÜNÜNDEKİ netleşme de geri alınır (S97 B): aynı gün tahsilat önce kendi tarafını kapatır | d24 A1 / A2 / A6, d19 N5 (mutant 236) |
| Z67 | Dünkü netleşme geri alınmaz (sınır): yalnız iki gün önceki | d20 P6 (mutant 239) |
| Z68 | Verilen avans kalem sayılmaz (S98 B): tahsilat önce borç kalemini kapatır | d25 R1, d19 N6, d22 V5 (mutant 237) |
| Z69 | Avansın sıradaki günü kayar (ertesi gün) — vadesi ertesi gün olan borçla eşitlik | d25 R2 (mutant 240) |
| Z70 | Avans takvim / Vade Takip / projeksiyon kalemi değil (S96 B) ya da günü ertesi gün | d22 V0–V6, d17, d23 (mutantlar 235, 238) |
| Z71 | Kalemi kapatmış / silinmiş Ödeme kalem olarak kalır | d22 V2 / V6, d17 TK / TR, d20 p1o |
| Z72 | Ödeme kendi tarafını aşınca fazlası kaybolur ya da karşı kalemle netleşir | d20 P4 |
| Z73 | Aynı adlı iki carinin karşı kalemleri / avansları birbirine sayılır | d20 P5a / P5b, d17 TA1 / TA2 |
| Z74 | Gün dönümü: ödeme günü "today" 0 ↔ ertesi gün "overdue" −1; vade günü ↔ ertesi | d22 ↔ d23, d20 ↔ d21 |
| Z75 | Kâhin SK-9 … SK-13 ve Y5-7 durumlarında değer uydurur | d26 S9–S13, G2 (G1 yazılır) |
| Z76 | Faturanın belge durumu S98 ile değişebilen caride tek taraflı kuyruktan yazılır | d25 R3, d26 S10 / S13 |
| Z77 | Aynı gün birden çok kalem ve ödeme: o günün kalemleri önce, ödemeler yazım sırasıyla | d24 A4 / A6 |

### Senaryolar (bakım 5; elle tablolar — kâhin koşulmadan karar metinlerinden elle; toplam 319 elle denetim (d17–d26). İLK koşuda bütün elle denetimler kâhinle aynıydı; kanıttan önceki Y5-7 inceltmesi d26 G1'in 4 denetimini değiştirdi — aşağıda)
- **`d20-c5-s95-netlesme-sonrasi-odeme`** (bugün 20.03; 59): P1 S95'in örneği (elle Borç vade 31.03) · P2 aynısı faturalarla (alış belge 0 "Ödendi", satış belge 10.000) · P3 SK-6 örnek 2
  (Alacak 100 açık) · P4 ödeme kendi tarafını aşar (avans 300) · P5a / P5b aynı adlı iki cari · P6 netleşme dün, ödeme bugün · sayaçlar 3 / 6.
- **`d21-c5-s95-ertesi-ay`** (aynı adımlar, bugün 01.04 — GÜN / AY DÖNÜMÜ; 9): Borç 31.03 → gecikmiş 10.000.
- **`d22-c5-s96-avans-kalemi`** (bugün 15.06; 44): V0 avans bugün · V1 tedarikçi avansı · V2 avansı alış kapattı (kalem yok) · V3 bağ fazlası · V4 müşteriye avans + vadesi gelmemiş Borç
  (görünüm toplamları, Vade Takip ÇATAL) · V5 S98 ile (avans 50) · V6 silinen Ödeme · sayaçlar 5 / 7 kesin.
- **`d23-c5-s96-avans-ertesi-gun`** (aynı adımlar, bugün 16.06 — GÜN DÖNÜMÜ; 6).
- **`d24-c5-s97-ayni-gun`** (bugün 15.03; 39): A1 S97'nin örneği · A2 Borç dün · A3 tahsilat ertesi gün (Y5-1 sıçraması: Alacak 300 açık) · A4 aynı gün üç kalem + iki ödeme · A6 tahsilat
  o günün kalemlerinden ÖNCE yazılmış.
- **`d25-c5-s98-avans-sirasi`** (bugün 15.03; 23): R1 S98'in örneği · R2 sınır (Borç vadesi avanstan bir gün sonra) · R3 satış faturasıyla (belge durumu yazılmaz — SK-13) · R4 vadesiz
  Borç avanstan önce.
- **`d26-c5-bakim5-susan`** (bugün 15.06; 40): S9 / S10 / S11 / S12 / S13 (SK-9 … SK-13) ve G2 (Y5-7) susar; G1 (KS8 müşteri, tahsilat avanstan önce vadeli Borç'u kapatıyor) yazılır.
- **Kararla DEĞİŞEN eski elle tablolar (C0j):** d17 (S96: sayaçlar ÇATAL 0…6 / 1…7 → 6 / 7; `elleYok`'taki avans kalemleri ve görünüm toplamları değer oldu; +ob, os, og, oa, ok, or),
  d18 (sayaç 6, ob "overdue" −1), d19 (N1, N2, N3, N5, N6 artık kararlı — 29 `elleYok` + 6 `elleBelirsiz` → değer; N4 aynen susar). Yeni değerler kâhin koşulmadan elle yazıldı.
- **Kâhin koşulduktan SONRA düzeltilen tek elle beklenti:** d26 G1 — ilk yazımda Y5-7 koruması kaba idi (verilen avanstan sonra herhangi bir bağsız alacak satırı → sus); kanıttan önce
  koruma C17.6'daki hâline inceltildi (S98'in sırayı GERÇEKTEN değiştirebildiği durum); G1'de tahsilat vadesi avanstan önce olan Borç'u kapattığından korumanın dışında kaldı. G1'in yeni
  değerleri (Borç 300, avans 200, gecikmiş 500) KS8 geri ödemesi + S2 sırasından elle yazıldı; korumanın içindeki karşılığı G2 eklendi.

### C10j Mutantlar (bakım 5; `oz-test.py` DEĞERLE — çökmeden, elle tablo kırmızı)
234 S95 B (netleşme geri alınmaz) · 235 S96 B (avans kalem değil) · 236 S97 B (aynı gün de geri alınır) · 237 S98 B (önce yükümlülükler) · 238 S96 sınırı (avans günü ertesi) · 239 S95 sınırı
(yalnız iki gün önceki netleşme) · 240 S98 sınırı (avansın sıradaki vadesi ertesi gün). Eski mutantlar 206 / 207 / 214 / 228 / 229 yeni motorda da (sıra, HAVUZ, vadede netleşme, zamandan
bağımsız netleşme).

### Dil ekleri (/3, bakım 5)
Yeni adım YOK. Yeni çıktı anahtarı YOK (biçimleri bugünkü): `takvim | vadeTakip | projeksiyon:hareket:<Ödeme adımı>` artık Ödeme hareketleri için de yazılır. Yeni `belirsiz` kayıtları:
"cari <ad> net görünüm tanımsız (2.5.0 C16.2): okumalar ayrışıyor (…) — KULLANICIYA SORULMALI SK-9 … SK-12 (§17)", "… verilen avans + sonra bağsız alacak yönlü satır — S98 tek taraflı kuyrukta
kurulmuyor (…; Y5-7)", "cari <ad> fatura belge durumu tanımsız (2.5.0 C17): …".

### Eşleme notları (Ç5-B kod ajanı / ana oturum için; `kos.mjs`)
- `kos.mjs` DEĞİŞMEDİ. Okunan satırlar: 1–80 (başlık, GECIKMIS_ALAN / KARSILIKSIZ_CARI), 150–177 (kimlik kaydı), 178–275 (`kontrolV3` okumaları), 398–480 (adım gövdeleri: cari_ac, tahsilat,
  borc / alacak, odeme, hareket_sil …, stok_iade / alis_iade), 1016–1050 ve 1132–1143 (karşılaştırma — yalnız kâhinin anahtarları karşılaştırılır).
- Ödeme avans kalemi: koşucu `takvim:hareket:<ad>`'ı her kayıtlı hareket için (`ids.hareket` — Ödeme adımı da `hareketKaydet` ile kayıtlı) `/dues` kalemlerinin `account` kaynaklılarında
  `entryId === <Ödeme hareket kimliği>` ile; `vadeTakip` / `projeksiyon:hareket` satırda Ödeme kimliği geçen ilk satırla okur. Program avans kalemini başka bir kimlik biçimiyle (ör. kaynağı
  `account` değil) gösteriyorsa koşucu "yok" okur → fark; önce hata sayılır (ders 6), kimlik biçimi koşucuya eşleme olarak eklenir (yalnız eşleme; kural değişmez).
- `GECIKMIS_ALAN` ve `KARSILIKSIZ_CARI` hâlâ `null` — programın alan adını bilmeyi gerektirir (Ç5-B / Ç5-A verir); bu kâhin VERMEZ.
- **Ana oturuma:** `model.py` değişti — mobil yazma kâhininin `cari_model_sha256`'sı yeniden üretilmeli (o dosya okunmadı).

### KULLANICIYA SORULMALI — özet (bakım 5; hepsi UÇ DURUM, öneri + "Uç durum böyle kalsın")
SK-9 (K1 ↔ K2), SK-10 (verilen avansın kalemle kapanışı geri alınır mı), SK-11 (alınan avans ↔ karşı borcumuz — Ödeme'nin sırası), SK-12 (açık alış iadesi alacağı ↔ verilen avans), SK-13
(avanslı caride satış faturasının belge durumu) — metinleri yukarıda (Yorumlar'ın altında). Kâhin bu durumlarda değer yazmaz (d26). Ayrıca Y5-1 sıçraması (aynı gün ↔ ertesi gün tahsilat)
KARAR METNİNİN HARFİ sayıldı; baş mimar kullanıcıya göstermeli (d24 A1 ↔ A3).

### C12j DENENMEYEN (bakım 5; neden)
- Program koşulmadı (görev: programla karşılaştırmayı ana oturum yapar). Programın Y5-1 sıçramasında, SK-9 … SK-13'te ve Y5-7'de ne yaptığı bilinmiyor.
- İLERİ tarihli Ödeme (avans kaleminin vadesi bugünden sonra — "upcoming"): programın ileri tarihli nakit Ödeme'yi kabul edip etmediği bilinmiyor → senaryo yazılmadı (kural aynı: gün = ödeme günü).
- Ciro avansının kalem başına denetimi (kalem kimliği evrakta; sayaçta belirsiz üye). Ciro carisinin görünüm toplamı (§13'ten beri tanımsız — portföy / ciro evrakı) aynen yazılmıyor.
- Yalın olmayan caride (kart, taksitli fatura, fatura iadesi, şüpheli / değersiz, KS8 / KS9, kart tahsilatı, tablo bağı, iki yönde iade) karşı yönlü kalemle net görünüm — karar yok, susar
  (§16 aynen). Y5-7: yalın olmayan caride S98'in tek taraflı kuyrukta kurulması — kurulmadı (koruma: susar).
- Zil (bildirim) metni, WhatsApp elemesi (tedarikçiye avans hatırlatması gitmez — Ç5-C), Mahsup Et (dilde yok) — §16 aynen.
- Müşterinin bize verdiği avansın "Ödenecek Borç" kalemi olmadığı (değişmedi) — ayrı anahtarla denetlenmiyor (sayaç ve görünüm toplamı üzerinden).

### C0j Değişen eski beklentiler (G3; bakım 4 `14e3f4bb` ↔ bakım 5 kâhin çıktısı, `2.5.0`; eski kopyanın 73 elle senaryosu + rastgele s1 / ux18 tohum 1–10 × 120) — kararla ilgisiz eski beklenti DEĞİŞMEDİ
Toplam 1.612 denetim satırı (eski 42.653 → yeni 43.855 denetim); her satır o KONTROL anındaki iki modelin izinden sınıflandı, **BEKLENMEYEN 0**, değeri aynı kalıp etiketi değişen 0
(dökümü `docs/kanit/2026-11-10/kahineski5-g3-dokum.json`, özet `kahineski5-esdeger-cari-*.log`; iki saat diliminde bayt bayt aynı). **Türev sayaçlar dışında değeri değişen denetim YOK** — bakım 4'ün
yazdığı her değer (okumaların birleştiği yerler) bakım 5'te de aynı. Sınıflar:
- **S96-kalem (yeni) 1.230:** Ödeme hareketlerinin `takvim | vadeTakip | projeksiyon:hareket:<ödeme>` denetimi (410 × 3) — 117'si avans kalemi, 1.113'ü "yok" (kalemi kapatmış / silinmiş Ödeme).
- **S96-gorunum (yeni) 54:** avanslı carinin görünüm toplamları (`takvim | vadeTakip | projeksiyon:cariToplam`, 14 × 3) ve o carinin `vadeTakip | projeksiyon:fatura` kalemleri (6 × 2) — d17, d18, d19.
- **geri-kazanilan (yeni) 102:** bakım 4'te okumalar ayrıştığı (SK-6 / SK-8) için tanımsız olan caride artık değer — d19 53 (N1, N2, N3, N5, N6), rastgele s1-10 22, s1-4 12, c12 10 (B4: Borç +
  Alacak netleştikten sonra stok iadesi), c8 5. Anahtarlar: Kalan 19, takvim / Vade Takip / projeksiyon kalemi 19 / 15 / 19, fatura kalemi 7, görünüm toplamı 6, açık toplam 12, gecikmiş 5.
- **Y5-7 (kalkan) 190:** yalın olmayan (KS8 müşteri) caride verilen avanstan sonra gelen bağsız alacak satırı S98 sırasını değiştirebiliyor — rastgele s1-4 84, s1-5 68, s1-6 38: belge durumu
  `fatura:acik` 52, fatura takvim kalemi 26, Kalan 28, elle kayıt takvim / Vade Takip / projeksiyon kalemi 28 × 3. **Bir ZAYIFLAMADIR** (bakım 4 bunları tek taraflı kuyruktan yazıyordu; S98 = A ile
  o kuyruk avansı kalem saymadığı için bu caride geçersiz; kâhin S98'i yalın olmayan caride kurmaz). İlk (kaba) korumayla 704 olacaktı; C17.6'daki inceltmeyle 190.
- **sayac** — değişen 22 (ÇATAL → daralan / kesin: Ödeme avansı artık kesin üye — c14a, c14e, d17, d18, s1-7), yeni 10 (sayacı tanımsız cari yüzünden yazılmayan kontrolde cari artık tanımlı — c8,
  c12, s1-4, s1-10), kalkan 4 (s1-4: net görünümü tanımsız caride Ödeme var — sayaç bilinmiyor; C17.7 kâhin düzeltmesi).
- **S95-S97-S98 / S98-tek / SK-9-12 / SK-13 (değişen ya da kalkan): 0** — bakım 4'ün yazdığı hiçbir net görünüm değeri karar okunuşuyla değişmedi, hiçbiri yeni okumaların ayrışmasıyla kalkmadı
  (yeni susmalar yalnız bakım 4'ün de sustuğu ya da elle senaryolardaki yerlerde).
- Senaryo senaryo: c10 S96-kalem 15 · c11 6 · c12 S96-kalem 9 + geri-kazanilan 10 + sayaç 2 · c13 9 · c14a 9 + sayaç 6 · c14e 9 + sayaç 6 · c6 36 · c8 69 + geri-kazanilan 5 + sayaç 2 · c8b 3 ·
  d17 S96-gorunum 24 + S96-kalem 24 + sayaç 2 · d18 aynı · d19 S96-gorunum 6 + S96-kalem 6 + geri-kazanilan 53 · d9 18 · s1-1 27 · s1-10 36 + 22 + sayaç 2 · s1-2 30 · s1-3 138 · s1-4 276 + Y5-7 84
  + 12 + sayaç 8 · s1-5 9 + Y5-7 68 · s1-6 72 + Y5-7 38 · s1-7 246 + sayaç 6 · s1-8 48 · s1-9 111. Rastgele ux18 ve öbür elle senaryolar: 0.
- **Hâlâ kalkık (bakım 4'ün S92-tanımsız 2.163'ü):** bakım 4'ün dökümü bakım 3 çıktısıyla yapılmıştı; bu bakım bakım 3 kopyasını açmadı (görev metni yalnız `14e3f4bb` kopyasını verir) — sayım
  cari-kesim düzeyinde (`kahineski5-susan-say-*`, aynı küme, 1.438 cari-kesim): **bakım 4** net görünüm tanımsız: okumalar ayrışıyor 21 (o carilerde 166 etkin kayıt / Ödeme, 56 fatura), tanım alanı
  dışı 69 (818 / 342) · **bakım 5**: okumalar ayrışıyor 11 (139 / 53; ayrışan okuma SK-9 11, SK-10 10, SK-12 10 — aynı cari-kesimlerde birlikte), tanım alanı dışı 69 (818 / 342 — AYNEN; karar yok),
  Y5-7 5 (35 / 26) + belge durumu Y5-7 8 (52 fatura). Yani geri kazanılan: okuma ayrışmasından çıkan 10 cari-kesim (G3'te 102 denetim); kalkık kalanın büyük kısmı tanım alanı dışı (KS8 / KS9
  etkileşimi, kart, iade …) — S95–S98 bunlar için kural getirmedi.
- `--kural 2.4.9` / 2.4.6 / 2.4.5 / `--legacy`: **372/372 bayt bayt aynı** (73 elle + 20 rastgele × 4 kip); üretici 20/20 aynı dizi.
- **Yeni elle tablolar ESKİ (bakım 4) kâhinde — beklenen NEDENLE kırmızı (ders 7, 38):** 319 elle denetimin 189'u (d17 13, d18 2, d19 25, d20 45, d21 9, d22 25, d23 4, d24 32, d25 18, d26 16;
  dökümü `kahineski5-kirmizi-eski-cari-*.log`): eski kâhin SK-6 / SK-8 carilerinde susuyor (Kalan, takvim, gecikmiş "ANAHTAR YOK" — d19 N1…N6, d20 P1–P4 / P6, d24, d25 R1 / R2 / R4, d22 V5),
  avans kalemi / görünüm toplamı yazmıyor (S96 — d17, d18, d22, d23), sayaçlar ÇATAL (d17 0…6 → 6), bakım 5'in sustuğu yerde değer yazıyor (d26 S10 gecikmiş 0 / S10F belge 0, G2 Kalan 300, d25
  R3F belge 0) ve yeni `belirsiz` kayıtları yok. Kalan 130'u iki kâhinde aynı (bakiye, belge durumu, tek yönlü carilerin değerleri).

### Kanıt (bakım 5; iki saat dilimi — UTC ve Europe/Istanbul çıktıları bayt bayt aynı; kâhin `aa24db97` (sayım `cd47c8d0`), temiz ağaç; `docs/kanit/2026-11-10/kahineski5-*`, araçlar `kahineski5-arac/`)
cari öz test **2.972/2.972** (`-cari-oz-*`: elle tablolar 80 senaryo, mutantlar 200–240, saf TYK 172 kalem, bakım 4 + 5 çapraz denetimi: saf net 115 kalem karşı yönlü kalemli caride + 519 tek
yönde, avans 248 cari, (ii) 300, gecikmiş (i) 382; susulan okuma ayrışan 7, tanım alanı dışı 20; S98 ile kendi tarafından ayrışan 10 cari) · defter öz test **171/171** (defter DEĞİŞMEDİ) · mutasyon
taraması **207/207** (`-cari-mutasyon-*`; kos.mjs düzeni, 80 dosya × kipler) · eşdeğerlik + G3 **393/393** (`-esdeger-cari-*`) · yeni / güncellenen elle tablolar **319/319** (`-elle-yeni-cari-*`) ·
ESKİ kâhinde **189 kırmızı** / 319 (`-kirmizi-eski-cari-*`) · geniş tarama **1.583/1.583** (`-genis-tarama-*`: s1 tohum 1–30 × 120, 390 kontrol kesimi — saf net 518 + 516, tek yön = kendi
tarafı 1.750, (ii) 390, gecikmiş (i) 484; susulan: okuma ayrışan 30, tanım alanı dışı 215 — Y5-7 dahil) · susulan sayımı **1/1** (`-susan-say-*`). Mutasyon ve geniş tarama `flock -s -n …/olcum.lock`
ile koşuldu (ders 52). Program açılmadı.

## 18. 2.5.0 Ç5 bakımı 6 — S99 / S101 / S102 / S103 / S104 / S105 (+ bakım 5'in SK-13'ü) (10.11.2026, `date -u` 18:51; kararlar 10.11.2026 13:27, 18:22, 18:28 UTC; eski kâhinler bakımı 6 — kodu görmeyen AYRI el) — kural seti `2.5.0` = §13 + … + §17 + bu bölüm

`--kural 2.4.9` (ve 2.4.6 / 2.4.5 / `--legacy`) AYNEN — bakım 5'in modeliyle (`1ab2d1de`) bayt bayt eşdeğerlik kanıtta. Defter kâhini (`test/bagimsiz/defter/`) DEĞİŞMEZ: bu kararlar yalnız kapama
sırasını ve görünümleri (Kalan, fatura listesi, kart, takvim / zil, Vade Takip) değiştirir — yevmiye maddesi yazmaz ("Bitti" kart Mevcut Borç kartıdır, maddesiz — C13.2; fatura durumu yevmiyeyi
değiştirmez). **Bu bölümün ilk commit'i yalnız YORUMDUR (ders 40 — önce kural, sonra kod); senaryo / mutant / G3 sayıları kod ve kanıt commit'lerinde eklenir.**

### C00k Temiz oda (bakım 6)
- **Karar metni (AYNEN; ana oturumun karar özeti `scratchpad/kahin-eski6-kararlar.md` — iş listesi D'nin KULLANICI KARARI satırları; programın davranışını anlatan cümleler ana oturumca çıkarılmış;
  satırlardaki "UYGULAMA" / "KOD" süreç notları kural DEĞİLDİR, kullanılmadı):**
  - "KULLANICI KARARI 10.11 13:27 UTC (AYNEN: 'önerini uygula'; soru C'de S99): S99 = A — FATURA DURUMU da TEK kuyruktan: bağsız avans vade sırasıyla taksitli faturanın taksitlerini de kapatır;
    örnekte (avans 500 → taksitli B 300 → taksitsiz A 500) B 'Ödendi', A 300 açık; fatura listesi, kart, Vade Takip ve zil AYNI sayıyı gösterir; Σ fatura açığı = cari bakiyesi. 'Taksitli faturanın
    açığı = kartının kalanı' kuralı KUYRUK kalanıyla sürer (2.4.9'daki 'bağsız para taksitli faturanın kartına harcanmaz' kuralı bu kararla DEĞİŞTİ)."
  - "KULLANICI KARARI 10.11 18:22 UTC (AYNEN: 'a'; soru C'de S101): S101 = A — müşterinin borcu AVANSLA zaten kapanmışken o satış için taksit kartı açılırsa tek kuyruk ilkesi aynen uygulanır:
    avans satışı kapatmıştır, kart 'Bitti' görünür; kartın tahsilatı müşterinin avansına eklenir; sonraki borç avanstan kapanır. Örnek: 1.000 avans → 600 veresiye satış 2 taksit (300 + 300) →
    Taksit Tahsilatı 300 → Borç Yaz 500 ⇒ takvim / zil boş, gecikmiş 0, müşteri 200 alacaklı; kalemler toplamı = bakiye."
  - "KULLANICI KARARI 10.11 18:28 UTC (AYNEN: 'önerilerini uygula, işler ilerliyormu?'; sorular C'de S102–S105): S102 = A, S103 = A, S104 = A, S105 = A. S102 = A: bir borç kalemi iki ayrı günde
    iki karşı kalemle netleşmişken ödeme sonrakinin GÜNÜNDE gelirse aynı günün netleşmesi kalır (S97), ÖNCEKİ günün karşı kalemi açılır (örnek: 01.06 Borç 1.000 · 02.06 Alacak X 300 · 03.06 Alacak
    Y 300 + aynı gün tahsilat 1.000 ⇒ X 300 açık, Y 0, müşterinin avansı 300). S103 = A: verilen avansın alış faturasıyla kapanması KESİNDİR; tedarikçi sonradan avansın tamamını geri öderse alış
    'Ödendi' kalır, tedarikçinin fazlası onun bizdeki avansı olur, kalem değildir (örnek: 01.03 Ödeme 500 · 05.03 alış 300 · 10.03 tedarikçiden tahsilat 500 ⇒ alış 'Ödendi', tedarikçinin avansı
    300). S104 = A: müşterinin bizdeki avansı ile ona borcumuz (Alacak) birlikte açıkken bağlamadan yaptığımız Ödeme VADE SIRASIYLA kapatır (S98'in simetriği; örnek: 01.03 tahsilat 500 · 05.03
    Alacak 200 vade 30.04 · 10.03 Ödeme 300 ⇒ avans 200 kalır, Alacak 200 açık). S105 = A: tedarikçide faturasız Alış İadesi alacağımız ile verilen avansımız birlikte açıkken yeni alış faturası
    ÖNCE alış iadesinden düşülür (önceki karar aynen; örnek: 01.03 Ödeme 300 · 05.03 Alış İadesi 200 · 10.03 alış 250 ⇒ iade alacağı 0, avans 250). Ayrıca kullanıcıya gösterilen 'aynı gün /
    ertesi gün' sonucu (bakım 5 Y5-1 …) için itiraz gelmedi → kalır."
  - Bakım 5'in SK-13'ü için baş mimar okuması (aynı dosya): "SK-13 … S99 = A ile YANITLI sayılır ('fatura listesi, kart, Vade Takip ve zil AYNI sayıyı gösterir'). Bu okumayı karar metninden
    KENDİN doğrula …" — doğrulaması Y6-2'de.
- **Soruların seçenekleri (aynı dosya, AYNEN özet):** S99 B (SEÇİLMEDİ) "önceki sürümün kuralı aynen — fatura durumunda bağsız para taksitli faturanın kartına harcanmaz: A 'Ödendi', B 300 açık" ·
  S101 B (SEÇİLMEDİ) "kart kendi borcunu taksitleriyle taşır; avans kartın DIŞINDAKİ borçlara gider; örnekte 2. taksit 300 takvimde kalır, 500 borç avanstan kapanır, 500 avans durur" · S102 B
  "netleşme tarih sırasıyla yeniden kurulur: X 0, Y 300 açık, avans 300" · S103 B "S95 gibi geri alınır: alış 300 açık ('Ödenecek Borç 300')" · S104 B "önce yükümlülük: Alacak kapanır, avans
  400" · S105 B "vade sırası (avans 01.03 önce): avans 50, iade alacağı 200"; S102–S105'in C'si "Uç durum böyle kalsın (BİLİNEN SINIR)".
- **Birlikte okunan önceki kararlar (`git show f2d152c1:docs/2.5.0-IS-LISTESI.md` C ve D; E / KAYIT okunmadı):** 05.11 ~18:55 S1 = A (vadesiz borç ertesi gün gecikmiş), S2 = A ("Vadesi en önce
  gelen"), S5 = A ("fatura iptal edilince ayrıca bağlanmış tahsilat … avans olarak kalsın"), BAŞ MİMAR M1a (tek yükümlülük kuyruğu), M1e (taksit kartı alttaki borcu tüketir), M1f; 05.11 21:30 (1) =
  A (ANINDA; "kapanmış kalem yeniden açılmaz"), (2) = A ("bağ (Mahsup Et, Kapatılacak Fatura, iade, kart tahsilatı) hedefini her durumda kapatır; hedefi önceden kapatmış bağsız ödeme serbest
  kalır ve kendi tarihinde yeniden dağılır"), (4) 2B-S3 = A ("kart küçülmesi … vadesi en önce gelen açık taksitten başlar; küçülme kartın açık kalanını aşarsa fazlası carinin avansı"), (5) = A
  ("… faturaların Açık / Ödendi durumu yalnız Mahsup Et ile"); 06.11 S15 = A ("kartın tahsilatları carinin avansı olur"), S50 = A, S52 = A, S68 = A; 06.11 19:33 S92 = A, S93 = A; 10.11 13:20
  S95–S98 = A (§17 C00j). Kural kitabı (kodu görmeyen mali müşavir, kararlardan ÖNCE): EK-1 §1 adım 1 (borç / alacak kalemleri; "taksit kartı taksitleri"), adım 2 ("kart açıldığı gün kart tutarı
  kadar kuyruk kalemini TÜKETİR … kart ile alttaki borç ASLA birlikte sayılmaz"), adım 3–6, M1(e), §4 (1)–(3); EK-2B madde 32 ("kart … hiçbir zaman alttaki borcun üstünde kalmaz"), madde 35, K-2.
- **Okunan / okunmayan:** tam liste (satır aralıklarıyla) ajan raporunda. Görev metninin yasakları aynen (`server/**`, `client/**`, `bulut/**`, `packaging/**`, `tools/**` — yalnız `kanit.mjs`
  çalıştırılır —, `docs/erp/C5-ACILIS-TASARIM.md`, `docs/erp/C5B-TYK-TASARIM.md`, `docs/devir/**`, iş listesinin GÜNCEL hâli, iki kâhin klasörü dışındaki `test/**`, başka ajanların
  `docs/kanit/**` dosyaları, git farkı / geçmiş içeriği). f2d152c1'in C / D satırlarında programdan söz eden parçalar var (S91–S93 "(kodlanan)", "C5 §2.10 madde 7", "C5 §4 madde 20", "denendi:
  kâhin c13'te …"; S90'da dosya:satır; S94'te hata kodu; D'de BAŞ MİMAR satırlarında rota / dosya adları) — KULLANILMADI; hiçbir kural bunlardan türetilmedi. Program koşulmadı; programın davranışı
  aranmadı. CLAUDE.md "Açık iş"teki program durumu kural / beklenti kaynağı sayılmadı.

### Yorumlar (ders 40 — karar metinlerinden; kod yazılmadan ÖNCE; baş mimar kullanıcıya gösterir)
- **Y6-1 — S102–S105 bakım 5'in `_okumalar5` boyutlarını kapatır (tek okuma):** S102 A = SK-9 A = biçim **K2** ("aynı günün netleşmesi kalır, ÖNCEKİ günün karşı kalemi açılır"; önceki günlerin
  netleşmesi en yeniden başlayarak geri alınır — S102 iki önceki günü ayırmıyor; K1 ile K2 yalnız aynı gün netleşmesinin kesinliğinde ayrışıyordu) · S103 A = SK-10 A = verilen avansın kalemle
  kapanışı **kesin** (S95'in geri alması yalnız İKİ YÜKÜMLÜLÜK KALEMİNİN netleşmesi için — S103 × S95 çelişmez) · S105 A = SK-12 A = **iade-önce** (C13.4 (10) aynen; gelen alacak yönlü kalem
  önce açık alış iadesi alacağından, kalanı borç yönlü satırlara — verilen avans dahil — S98'in tek vade sırasıyla) · S104 A = SK-11 A = gelen bağsız **Ödeme** alacak yönlü kalemleri ve alınan
  avansı **tek vade sırasıyla** kapatır (S98'in simetriği; alınan avansın vadesi = belge günü = tahsilat günü). Kararla belirlenen her susulan denetim değere döner (d26 S9–S12; geniş taramadaki
  "okumalar ayrışıyor" carileri). Okuma ayrışması ancak Y6-8'in açık bıraktığı yerde kalır.
- **Y6-2 — SK-13 (bakım 5; avanslı caride satış faturasının BELGE durumu) S99 A'nın kapsamında — doğrulandı:** SK-13'ün iki seçeneğini ayıran tek sonuç, fatura listesinin takvim / Vade Takip ile
  aynı resmi gösterip göstermemesiydi (A "cari kartı, takvim ve fatura listesi aynı resmi gösterir" ↔ B "takvim ile fatura listesi ayrışır"). S99 A bu ayrımı açıkça seçiyor: "FATURA DURUMU da TEK
  kuyruktan … fatura listesi, kart, Vade Takip ve zil AYNI sayıyı gösterir". "Tek kuyruk" S98 A ile verilen avansı kalem sayan kuyruktur (S96: takvim / Vade Takip'te ayrı kalem) → faturanın belge
  durumu bu kuyruktan, **iki yükümlülük kalemi netleşmeden** okunur: (5) "faturaların Açık / Ödendi durumu yalnız Mahsup Et ile" ve K-2 "S listede 'Açık 10.000'" karşı yönlü KALEMLER (satış ↔
  alış) içindir; S99 değiştirdiği kuralı adıyla söylüyor ("2.4.9'daki … kuralı bu kararla DEĞİŞTİ") ve (5)'i anmıyor → (5) sürer (bakım 5'in `yy=False` belge görünümü). "Σ fatura açığı = cari
  bakiyesi" S99'un örneğinde (bütün açık kalemler fatura) doğrudur; genel biçimi EK-1 §4 (2) (Σ açık borç kalemi − Σ açık alacak kalemi = bakiye; verilen avans kalemi borç yönlü kalemdir). Sonuç:
  yalın caride `belge_tanimsiz` kalkar; `fatura:<ad>:acik` ve `acikToplam` belge görünümünden yazılır (SK-13'ün örneği: fatura "Açık 100", avans 50).
- **Y6-3 — S99 A: taksitli fatura (faturanın kendi kartı, "Bu Satışı Taksitlendir"):** taksitleri tek kuyrukta borç yönlü yükümlülük kalemidir (C13.4 (1) aynen: belge günü = fatura günü, vade =
  taksit tarihi — eşit tutar, artık kuruş sonda, ilk vadeden ayda bir [YAYGIN]); bağsız avans (alınan — tahsilat / evrak / bağ fazlası; S98 ile verilen avans da kalem) onları vade sırasıyla
  kapatır; taksitli faturanın belge açığı = taksitlerinin kuyruk kalanı. §13'teki kâhin kuralı (C13.4 (5) "vadesi gelmemiş ama öbür borçlardan erken vadeli taksit de aynı sırada — kâhin okuması",
  C13.4 (7)) S99 A ile KULLANICI dayanağı kazandı; `--kural 2.4.9`'da 2.4.9 kuralı (açık = tutar) aynen.
  - **Tanım alanı genişler:** karşı yönlü kalemi OLMAYAN caride "taksitli fatura" artık yalın olmayan nedeni değildir → iki yönlü tek kuyruk (S98: verilen avans kalem; S95–S98, S102–S105)
    taksitlerle kurulur; bakım 5'in Y5-7 koruması bu cariler için kalkar (Kalan, belge durumu, gecikmiş, avans kalemi, `acikToplam` yazılır).
  - **Kalmaya devam eden:** karşı yönlü kalemli caride taksitli fatura (SK-15), taksitli faturanın iadesi (C13.4 (11) — Ç7b / 2B-S3; S99 iadeyi söylemiyor), taksitli faturanın takvim / Vade Takip /
    projeksiyon kalemi ve o carinin görünüm toplamı (kalemin biçimi — tek fatura kalemi mi, taksit başına mı, hangi kimlikle — kâhinin dilinde bilinmiyor; karar TUTARI söylüyor, kalem biçimini
    değil; eşit taksit tarihleri YAYGIN varsayım), "kart" = faturanın kendi kartı (kâhinin dilinde ayrı anahtarı yok — koşucu yalnız Taksitler'den açılan / aktarılan kartı okur; eşleme notu).
    Taksitli faturaya bağlı tahsilat / evrak yok (B2 aynen).
- **Y6-4 — S101 A: avansla kapanmış borca açılan Mevcut Borç kartı ("Bitti"):** Mevcut Borç kartı (Taksitler'den `kart_ac {mevcut}` ve Tablodan Aktar'ın mevcut borç kartı) açıldığı gün açık borç
  kalemlerini M1e ile tüketir; açık borç kart tutarından AZSA (§13'te EK-2B 32 → C13.4 (11) tanımsız) ve eksik kalan kısım carinin borç kalemlerinin AVANSLA (bağsız PARA: tahsilat, alınan evrak, bağ
  ve kart tahsilatı fazlası — S101 "AVANSLA") kapanmış kısmından karşılanıyorsa, kartın o kadarı ÖDENMİŞ sayılır ("avans satışı kapatmıştır, kart 'Bitti' görünür"): ödenmiş sayılan tutar kartın
  taksitlerine **vadesi en önce gelenden** yazılır (S99 A "vade sırasıyla"; 2B-S3 A "vadesi en önce gelen açık taksitten"; C13.4 (3) kart tahsilatı "kartın vadesi ilk gelen açık taksitinden"); kapanmış
  kalem yeniden açılmaz ((1) A). Kart tahsilatı kartın açık taksitine, kalmadıysa carinin avansına (S101 "kartın tahsilatı müşterinin avansına eklenir"; S15 / C13.4 (3) "fazlası bağsız"); sonraki borç
  avanstan kapanır (ANINDA). Kart `kalan` = toplam − ödenen (Bitti: 0), `odenen` = toplam − kalan, taksit başına ödenen; defter kalanı (C13.4 (7)) kartın avansla ödenmiş sayılan kısmını kartın
  "ödenen"inden düşer.
  - **Kısmen avansla kapanmış borca kart** aynı ilkenin sonucudur: açık kısım M1e ile tüketilir, avanslı kısım ödenmiş taksittir (vade sırası S99 A ile KULLANICI kuralı — baş mimar netleştirmesi
    değil). Örnek: avans 400 → satış 600 + kart 600 (2 × 300) → 1. taksit 300 + 2. taksitin 100'ü ödenmiş, 2. taksit 200 açık; kart kalanı 200 = bakiye.
  - **Kalmaya devam eden:** kart, alttaki borcun açık + avanslı kısmından da büyükse EK-2B 32 tanımsızlığı AYNEN; borç avansla değil stok / fatura iadesi ya da Değersiz Alacak'la kapanmışsa
    (S101 "AVANSLA" der) tanımsız AYNEN; Mevcut Borç kartı birden çok kalemi tükettiyse C13.4 (7) / (11) AYNEN; karşı yönlü kalemli kartlı cari (C16.2 aynen); verilen avanslı kartlı cari (SK-16).
- **Y6-5 — S101 × (2) A (iki okuma — SK-14):** S101'in örneğinde Taksit Tahsilatı, kart avansla "Bitti" olduktan SONRA geliyor. (a) **S101'in harfi:** tahsilat kendi gününde carinin avansına
  eklenir (bağ fazlası gibi o gün açık borçlara vade sırasıyla). (b) **(2) A:** bağ hedefini her durumda kapatır — tahsilat taksiti kapatır, o taksiti önceden kapatmış avans serbest kalır ve
  kartın gününden itibaren yeniden dağılır. Örneğin sayılarını ikisi de verir (borç tahsilattan sonra doğuyor); kart açılışıyla tahsilat arasında vadeleri doğum sırasına uymayan borçlar doğarsa
  hangi borcun açık kaldığı (ve gecikmiş) ayrışır → kâhin iki okumayı da hesaplar, ayrışırsa o carinin kuyruk denetimlerini (açık, Kalan, kart ödeneni, gecikmiş) YAZMAZ (C13.4 (11) düzeninde).
- **Y6-6 — S99 × S101 × S50 / S52 (çelişki yok):** kart ve taksitli fatura taksitleri kuyruğa kendi taksit tarihleriyle girer (belge günü kartın / faturanın günü); Ödeme Sözü sırayı değiştirmez
  (S52); S50 (kart seçilmeden alınan tahsilat) ve S99 (bağsız avans) aynı kuralı söylüyor. Bekleyen avans aynı GÜN doğan taksitli ve taksitsiz faturaya olay (yazım) sırasıyla uygulanır (ders 31;
  S99'un örneği "avans → B → A" sırası) — kâhinin senaryoları farklı günlerle yazılır.
- **Y6-7 — S103 × S95 ve S104 × S95 (çelişki yok):** S95'in "kendi tarafı" bizim Ödememiz için alacak yönlü kalemler + alınan avanstır (Y5-1 (b)); S104 aralarındaki sırayı vade diye koyar; S95'in
  geri aldığı netleşme iki kalem arasındadır, verilen avans ↔ alış kapanışı S103 ile kesindir.
- **Y6-8 — S104'ün kapsamı DIŞINDA kalan (iki okuma — SK-17):** bakım 5'in Y5-3'ü alınan avans sorusunu "bizim ödememiz (ya da yeni borç yönlü kalem)" diye iki durumda kurdu; kullanıcıya giden
  SK-11 ve S104 A'nın karar metni yalnız "bağlamadan yaptığımız Ödeme"yi söylüyor. Alınan avans S96 / S103'e göre KALEM DEĞİLDİR (S98'in "avans da kalemdir"i verilen avans içindir) → yeni borç
  yönlü KALEMİN (satış, Borç Yaz, borçlu Açılış, stok veresiye) karşısında hem alınan avans hem açık alacak yönlü kalem (alış, Alacak) varsa sıra kararda yok: kâhin o boyutu (vade sırası / önce
  yükümlülük / önce avans) açık tutar, ayrışırsa susar. Gelen Ödeme'de tek okuma (S104).
- **Y6-9 — S105 × S98 × S103:** gelen alacak yönlü kalem (alış, Alacak, alacaklı Açılış) önce açık alış iadesi alacağını, sonra öbür borç yönlü satırları (verilen avans + borç yönlü kalemler) S98'in tek
  vade sırasıyla kapatır; avansla kapanış kesin (S103). Tedarikçiden gelen tahsilat + açık alış iadesi KS9 etkileşimidir (tanım alanı dışı — aynen).
- **Y6-10 — DEĞİŞMEYEN tanım alanı:** KS8 / KS9 etkileşimli cari (bakım 5'in Y5-7 korumasıyla kalkan 190 denetimin hepsi KS8 müşterisi — müşteriye Ödeme önce iade geri ödemesi; KS8.1 "kapattığı açık
  yeniden açılır" ile S95 / S103'ün "yalnız iki kalemin netleşmesi geri alınır" okuması bu kararlarda birleştirilmedi), şüpheli / değersiz, fatura iadesi, iki yönde faturasız iade, tabloya bağlı cari,
  karşı yönlü kalemli kartlı cari → §16–§17 aynen (karar yok; kâhin susar). Müşterinin bize verdiği avansın "Ödenecek Borç" kalemi olmadığı aynen (S103 "kalem değildir").

### KULLANICIYA SORULMALI (bakım 6; kâhin bu durumlarda SUSAR — ders 43, SORU DÜZENİ; hepsi UÇ DURUM)
- **SK-14 (S101 × (2) A — Y6-5):** kartı avansla "Bitti" olmuş satış için sonradan Taksit Tahsilatı girilirse para avansa HANGİ GÜNDEN eklenir? Örnek: 01.05 tahsilat 1.000 · 05.05 stoktan 600 veresiye
  satış + 2 taksit · 06.05 Borç Yaz 500 (vade 30.06) · 07.05 Borç Yaz 300 (vade 08.05) · 20.05 Taksit Tahsilatı 300; bugün 15.06. **A (öneri, S101'in harfi):** tahsilat günü (20.05) avansa eklenir,
  o gün açık borçları vade sırasıyla kapatır — 07.05'li 300 kapanır, 06.05'li 500'ün 100'ü açık (vade 30.06), gecikmiş 0 / **B ((2) A "bağ hedefini her durumda kapatır"):** tahsilat 1. taksiti
  kapatır, o taksiti kapatmış avans kartın gününden (05.05) serbest kalır — 06.05'li 500 kapanır, 07.05'li 300'ün 100'ü açık, 09.05'ten gecikmiş 100 / **C:** uç durum böyle kalsın (BİLİNEN SINIR).
- **SK-15 (S99 × (5) / S92 — Y6-3):** aynı kişi hem müşteri hem tedarikçi; TAKSİTLİ satış faturası varken alış faturası gelirse? Örnek: 01.03 taksitli satış 900 (3 × 300; vade 01.04 / 01.05 / 01.06) ·
  10.03 alış 400; bugün 15.05. **A (öneri):** taksitler S92'deki gibi alışla kendi tarihinde netleşir (Vade Takip / zil: 1. taksit 0, 2. taksit 200, 3. taksit 300; gecikmiş 200); fatura listesi ve kart (5)'teki
  gibi brüt ("Açık 900") — S99'un "aynı sayı" cümlesi avans içindir / **B:** taksitli faturada fatura listesi ve kart da Vade Takip'le aynı net sayıyı gösterir ("Açık 500"; S99 burada (5)'in önüne geçer) /
  **C:** uç durum böyle kalsın (BİLİNEN SINIR). (Üçüncü bir okuma — taksitler alışla hiç netleşmez — kâhinde ayrıca hesaplanmaz; A ve B ikisi de netleşmeyi S92'den alıyor.)
- **SK-16 (S98 × M1e):** müşteriye avans vermişken (Ödeme) "Carinin Mevcut Borcunu Taksitlendir" kartı açılırsa kart verilen avansı da tüketir mi? Örnek: 01.05 müşteriye Ödeme 200 · 05.05 Borç Yaz 500 ·
  10.05 Mevcut Borç kartı 700 (2 taksit). **A (öneri):** hayır — kart yükümlülük kalemlerini (fatura, Borç, Açılış, taksit) tüketir; verilen avans ayrı "Tahsil Edilecek Borç" kalemi kalır, kart açık
  yükümlülükten büyükse EK-2B 32 ("kart hiçbir zaman alttaki borcun üstünde kalmaz") / **B:** evet — verilen avans da carinin borcudur (S98), kart onu da taksitlendirir, avans kalemi kalkar / **C:** uç durum böyle kalsın (BİLİNEN SINIR).
  Kâhin verilen avanslı kartlı caride susar (bakım 5 Y5-7 aynen).
- **SK-17 (S104'ün kapsamı — Y6-8):** müşterinin bizdeki avansı (fazla ödemesi) ile ona borcumuz (alış faturası / Alacak) birlikte açıkken yeni SATIŞ (ya da Borç Yaz) gelirse önce hangisinden düşülür?
  Örnek: 01.03 tahsilat 500 (borcu yok) · 05.03 aynı kişiden alış 300 · 10.03 satış 600. **A (öneri, S104 gibi vade sırası):** önce avans (01.03): satış kapanır (500 avans + 100 alış), alış 200 açık
  ("Ödenecek Borç 200"), avans 0 / **B (önce yükümlülük):** önce alış: satış kapanır (300 alış + 300 avans), alış 0, müşterinin avansı 200 / **C:** uç durum böyle kalsın (BİLİNEN SINIR).

### Kurallar (kod commit'i; yorumların `model.py`'deki karşılığı)
- **C18.1 (Y6-1) tek okuma — `_okumalar5`:** biçim K2 (S102), verilen avansın kapanışı kesin (S103), iade-önce (S105); gelen borç yönlü ÖDEME'nin sırası `_anah5` ile 's2' (S104). Kalan tek boyut:
  gelen borç yönlü KALEM × alınan avans + alacak yönlü kalem {s2, yukumluluk, odeme} (SK-17) — yalnız alacak yönlü kalem + alacak yönlü ödeme satırı + borç yönlü kalem olan caride açılır.
  Ayrışırsa `belirsiz` "okumalar ayrışıyor (…) — gelen borç yönlü kalem × alınan avans: KULLANICIYA SORULMALI SK-17 (§18)".
- **C18.2 (Y6-2) belge durumu — `belge250`:** yalın caride `fatura:<ad>:acik` (satış, taksitli satış, alış) = net250 "belge" görünümü (verilen avans kalem, iki yükümlülük kalemi netleşmeden);
  `belge_tanimsiz` yalın caride yalnız belge görünümü SK-17 okumasına bağlıysa neden verir. Yalın olmayan caride §13 tek taraflı kuyruk ve bakım 5'in `_s98_iki`'si AYNEN. `kontrol_acik_toplam`
  aynı belge değerlerini kullanır.
- **C18.3 (Y6-3) taksitli fatura:** `_net_uygun` "taksitli fatura"yı yalnız karşı yönlü kalemle yalın olmama nedeni sayar ("… SK-15"); `_net_satirlar` taksitli faturanın taksitlerini borç yönlü
  kalem satırları olarak ekler (`_taksit_plani` — `_alacak_tarafi_250` ile aynı plan; satır `taksit_of` = fatura); belge açığı = taksitlerin toplamı. SK-15 carisinde (taksitli + karşı yönlü
  kalem) o carinin faturalarının belge durumu yazılmaz (B okumasında alış da net görünürdü). `kontrol_acik_toplam` 2.5.0'da taksitli faturalı cariyi atlamaz (S99 "Σ fatura açığı = cari
  bakiyesi"; ≤ 2.4.9 aynen atlar). Taksitli faturanın takvim / Vade Takip / projeksiyon kalemi ve o carinin görünüm toplamı yazılmaz (`_cari_kalemleri` aynen None).
- **C18.4 (Y6-4 / Y6-5) S101 — `_tyk(s101=…)`, `_alacak_tarafi_250` → `_alacak_govde250`:** Mevcut Borç kartlı caride tüketim açık borçtan büyükse eksik, borç kalemlerinin bağsız PARAYLA kapanmış kısmından
  (önceki kartların ödenmiş saydığı kısım düşülerek) karşılanıyorsa kartın o kadarı ödenmiş sayılır — vadesi en önce gelen taksitten; karşılanmıyorsa EK-2B 32 (C13.4 (11)) AYNEN. İki okuma: R1
  (S101'in harfi — kart tahsilatının bağı avansla ödenmiş sayılan kısmı kapatamaz; `tahmin` ile kararlı olana dek yeniden hesap) ve R2 ((2) A — bağ önce, önceden kapatan avans kartın gününde
  serbest); sonuçlar (açıklar, kart ödenenleri, kuyruk kalanları, artan para) ayrışırsa C13.4 (11) nedeni "… KULLANICIYA SORULMALI SK-14 (§18)". Defter kalanı (C13.4 (7)) avansla ödenmiş sayılan kısmı
  kartın ödeneninden düşer. Kart anahtarları (`kart:<no>:odenen | kalan | taksitN:odenen`) yazılır.
- `--kural 2.4.9` / 2.4.6 / 2.4.5 / `--legacy`: hiçbir yol değişmedi (bütün yeni dallar `k250` ya da mutant).

### C8k Nasıl bozulur? (bakım 6 — kod commit'inde, senaryolarla birlikte yazıldı)
| # | Bozulma | Senaryo |
|---|---|---|
| Z78 | Bağsız avans taksitli faturanın taksitlerini kapatmaz (S99 B — 2.4.9): fatura listesinde taksitsiz fatura kapanır, taksitli açık | d27 P1 / P3, d28 / d29 (mutant 241) |
| Z79 | Taksitler kuyruğa faturanın gününde girer (vade sırası bozulur: aradaki vadeli Borç sonra kapanır) | d27 P2, d28 / d29 P2 (mutant 242) |
| Z80 | Verilen avanslı caride taksitli faturanın belge durumu / gecikmişi tek taraflı kuyruktan (S98 taksitlere uygulanmaz) ya da susulur | d27 P3 (mutant 249, 237) |
| Z81 | Avansla kapanmış borca açılan kart açık kalır / kart tahsilatı karta yazılır, avans serbest kalır (S101 B) | d30 Q1, Q3 (mutant 243) |
| Z82 | Kısmen avanslı borca kartta ödenmiş kısım son taksitten sayılır (vadesi geçmiş 1. taksit açık görünür) | d30 Q2 / Q4, d31 / d32 (mutant 244) |
| Z83 | Kart borçtan büyükken (ya da borç iadeyle kapanmışken) kâhin S101'i uydurur | d30 Q6 / Q7 |
| Z84 | S101 × (2) A'nın ayrıştığı yerde kâhin değer uydurur | d30 Q5 (SK-14) |
| Z85 | Netleşme tarih sırasıyla yeniden kurulur — aynı günün netleşmesi bozulur (S102 B) | d26 S9 (mutant 245); d33 T9a / T9b sınırları |
| Z86 | Verilen avansın alışla kapanışı sonraki tedarikçi tahsilatıyla geri alınır (S103 B) | d26 S10, d33 T10c (mutant 246); T10b aynı gün |
| Z87 | Bağsız Ödeme önce Alacak'ı kapatır, alınan avans durur (S104 B) ya da avansın günü kayar | d26 S11, d33 T11b / T11c (mutantlar 247, 250) |
| Z88 | Gelen alış önce verilen avanstan düşülür (S105 B) | d26 S12, d33 T12b (mutant 248); T12c iade önce |
| Z89 | Avanslı caride satış faturasının listesi takvimden ayrışır (SK-13 B) | d25 R3, d26 S13, d33 T13c (mutant 249); T13b fatura önce |
| Z90 | Taksitli satış + alış, ya da alınan avans + alış + yeni satış durumunda kâhin değer uydurur | d27 P5 (SK-15), d33 T17 (SK-17) |
| Z91 | Aynı adlı iki carinin avansı birbirinin taksitine / kartına sayılır | d27 P4, d30 Q8 |

### Senaryolar (bakım 6; elle tablolar — kâhin koşulmadan karar metinlerinden elle; toplam 335 elle denetim (d25 23, d26 69, d27–d33 243). İLK koşuda bütün elle denetimler kâhinle aynıydı)
- **`d27-c5-s99-taksitli-avans`** (bugün 15.06; 43): P1 kararın örneği · P2 taksitler farklı vadelerde, avans kısmen kapatır, aradaki vadeli Borç, sonraki tahsilat vade sırasıyla · P3 verilen avans +
  taksitli fatura (S98 × S99) · P4 aynı adlı iki cari · P5 SK-15 susar · sayaçlar 0 / 0.
- **`d28-c5-s99-taksit-vade-gunu`** (bugün 20.06 — 2. taksitin vade günü; 17) · **`d29-c5-s99-taksit-ertesi-gun`** (bugün 21.06 — GÜN DÖNÜMÜ; 17): P2 gecikmiş 0 → 100.
- **`d30-c5-s101-bitti-kart`** (bugün 15.06; 62): Q1 kararın örneği · Q2 kısmen avanslı borca kart · Q3 / Q4 kart tahsilatı açık kısmı aşıyor / aşmıyor · Q5 SK-14 susar · Q6 EK-2B 32 · Q7 iadeyle
  kapanmış borç · Q8 aynı adlı iki cari.
- **`d31-c5-s101-taksit-vade-gunu`** (bugün 01.07; 14) · **`d32-c5-s101-taksit-ertesi-gun`** (bugün 02.07 — GÜN DÖNÜMÜ; 14): Q2 / Q4 gecikmiş 0 / 0 → 200 / 100.
- **`d33-c5-s102-s105-sinirlar`** (bugün 15.06; 76): T9a / T9b (S102), T10b / T10c (S103), T11b / T11c (S104), T12b / T12c (S105), T13b / T13c (SK-13), T17 SK-17 susar; sayaçlar ÇATAL 8…9 (T12b'nin
  açık alış iadesi alacağı belirsiz üye — §17 aynen).
- **Kararla DEĞİŞEN eski elle tablolar (C0k):** d25 R3 (SK-13 → S99 A: `fatura:R3F:acik` 10.000, `acikToplam` 10.000 / `acikEsitBakiye` false; `elleYok` / `elleBelirsiz`'den çıktı) · d26 S9–S13
  (S102–S105 A, SK-13 ← S99 A: 13 `elleYok` + 5 `elleBelirsiz` → 48 değer). G1 / G2 (Y5-7, KS8) aynen. Yeni değerler kâhin koşulmadan elle yazıldı (betik
  `docs/kanit/2026-11-10/kahineski6-arac/guncelle-d25-d26.py`, `yeni-senaryolar.py` — değerler betikte elle).

### C10k Mutantlar (bakım 6; `oz-test.py` DEĞERLE — çökmeden, elle tablo kırmızı)
241 S99 B (taksitli faturanın taksitleri bağsız parayla kapanmaz) · 242 S99 sınırı (taksitler faturanın gününde vadeli) · 243 S101 B (kart kendi borcunu taşır, avans serbest) · 244 S101 sınırı
(ödenmiş kısım son taksitten) · 245 S102 B (K1) · 246 S103 B (avans kapanışı geri alınır) · 247 S104 B (Ödeme önce yükümlülük) · 248 S105 B (vade sırası) · 249 SK-13 B (belge tek taraflı
kuyruktan) · 250 S104 sınırı (alınan avansın sıradaki vadesi ertesi gün). Eski mutantlar 234–240 tek okumalı motorda da (Y5-1).

### Dil ekleri (/3, bakım 6)
Yeni adım YOK; yeni çıktı anahtarı YOK. `kart_tahsilat {kayit}` artık Taksitler'den açılan karta (`kart_ac`'ın `ad`'ı) da girilebilir (modelde zaten öyleydi — koşucuya eşleme eklendi, aşağıda).
Yeni `belirsiz` kayıtları: "… okumalar ayrışıyor (…) — gelen borç yönlü kalem × alınan avans: KULLANICIYA SORULMALI SK-17 (§18)", "… faturanın belge durumu okumaya bağlı (… SK-17 …)", "cari <ad>
faturaların belge durumu tanımsız (2.5.0 C18): taksitli fatura + karşı yönlü kalem — KULLANICIYA SORULMALI SK-15 (§18)", C13.4 (11) nedeni "S101 × (2) A … SK-14 (§18)"; EK-2B 32 nedeni Mevcut Borç
kartlı caride "— eksik kısım avansla kapanmış borçtan karşılanmıyor (S101 kurulmaz)" ekiyle.

### Eşleme notları (Ç5-B kod ajanı / ana oturum için; `kos.mjs`)
- **`kos.mjs` DEĞİŞTİ — yalnız eşleme:** `kart_tahsilat` adımı `kayit` bir `kart_ac` kartının adıysa kartın kimliği `ids.kart[...]` ile alınır (`POST /api/workspace/plans/<id>/entries`, gövde
  aynen); öbür durumda eskisi gibi kayıt anahtarıyla. Okunan satırlar: 573–600 (kart_ac / kart_tahsilat adımları), 240–275 (görünüm okumaları), 805–835 (fatura / kart okumaları).
- Yeni anahtar YOK. Faturanın KENDİ kartı (taksitli fatura) koşucuda okunmuyor — S99'un "kart" sayısı bu yüzden denetlenmiyor (eşleme önerisi: fatura kimliğiyle bağlı planın `totals.remaining`'i
  `fatura:<ad>:kartKalan` anahtarına okunursa kâhin `fatura:<ad>:acik` ile aynı değeri verir — bu bakımda EKLENMEDİ, programın uç / alan adı bilinmiyor).
- `GECIKMIS_ALAN` ve `KARSILIKSIZ_CARI` hâlâ `null` (§16 aynen).
- **Ana oturuma:** `model.py` değişti — mobil yazma kâhininin `cari_model_sha256`'sı yeniden üretilmeli (o dosya okunmadı).

### C12k DENENMEYEN (bakım 6; neden)
- Program koşulmadı (görev: programla karşılaştırmayı ana oturum yapar). Programın SK-14 … SK-17 durumlarındaki davranışı bilinmiyor.
- Tablodan Aktar'ın mevcut borç kartında S101 (aynı kod yolu; elle senaryo yazılmadı — Taksitler'den açılan kartla denendi).
- Taksitli faturanın kendi kartının sayısı ("kart" — koşucuda anahtar yok) ve takvim / Vade Takip kalemleri, o carinin görünüm toplamı (C18.3).
- Avans sonradan gelince (kart açıldıktan sonra) kartın taksitleri — S50 (§13) aynen; yeni senaryo yazılmadı.
- Aynı GÜN doğan taksitli ve taksitsiz faturaya bekleyen avansın sırası (Y6-6 — olay / yazım sırası; senaryolar farklı günlerle).
- KS8 / KS9 etkileşimli, şüpheli / değersiz, fatura iadeli, iki yönde iadeli, tabloya bağlı cariler ve karşı yönlü kalemli kartlı cari — karar yok, susar (§16–§17 aynen; Y6-10).

### C0k Değişen eski beklentiler (G3; bakım 5 `1ab2d1de` ↔ bakım 6 kâhin çıktısı, `2.5.0`; eski kopyanın 80 elle senaryosu + rastgele s1 / ux18 tohum 1–10 × 120) — kararla ilgisiz eski beklenti DEĞİŞMEDİ
Toplam 604 denetim satırı (eski 44.742 → yeni 45.346 denetim); her satır o KONTROL anındaki iki modelin izinden sınıflandı, **BEKLENMEYEN 0**, **değeri değişen 0, kalkan 0**, değeri aynı kalıp
etiketi değişen 0 (dökümü `docs/kanit/2026-11-10/kahineski6-g3-dokum.json`, özet `kahineski6-esdeger-cari-*.log`; iki saat diliminde bayt bayt aynı). **Bakım 5'in yazdığı hiçbir değer
değişmedi** — bütün farklar bakım 5'in SUSTUĞU yerde yeni değer:
- **S102-S105 (geri kazanılan) 576:** bakım 5'te okumalar ayrıştığı için (SK-9 … SK-12) net görünümü tanımsız caride artık değer — d26 45 (S9 / S10 / S11 / S12), rastgele s1-2 67, s1-4 70, s1-5 79,
  s1-8 281, s1-10 34 (Kalan, takvim / Vade Takip / projeksiyon kalemleri, avans kalemi, belge durumu, gecikmiş, açık toplamı).
- **SK-13←S99 (geri kazanılan) 6:** bakım 5'te faturanın belge durumu tanımsız caride (verilen avans + satış faturası) `fatura:acik`, `acikToplam`, `acikEsitBakiye` — d25 R3 3, d26 S13 3.
- **sayac (yeni) 22:** sayacı tanımsız cari yüzünden yazılmayan kontrolde cariler artık tanımlı — s1-2 4, s1-4 2, s1-5 4, s1-8 10, s1-10 2.
- **S99-taksitli / S101 / SK-14 / SK-15 / SK-17: 0** — eski kümede taksitli faturalı cari yalnız b2-ux18-retler ve d8 B'de (iadesi var — C13.4 (11) aynen), avansla kapanmış borca açılmış Mevcut Borç kartı
  yok, karşı yönlü kalemli taksitli caride bakım 5'in yazdığı değer yok; bu sınıflar yalnız yeni elle senaryolarda (aşağıda ESKİ kâhin kırmızısı).
- **Hâlâ kalkık (susulan sayımı `kahineski6-susan-say-*`, aynı küme, 1.482 cari-kesim):** bakım 5 → bakım 6 — okumalar ayrışıyor 15 → **0** (146 etkin kayıt / Ödeme, 55 fatura geri kazanıldı; ayrışan
  soru SK-9 15, SK-10 13, SK-11 3, SK-12 11 — aynı carilerde birlikte; boyut ilk okumayla konum konum karşılaştırılarak) · belge durumu SK-13 3 → **0** · Y5-7 (KS8 müşterisi, S98 tek taraflı kuyrukta) net görünüm 6 → 6 (37 kayıt / 26 fatura) ve
  belge durumu 9 → 9 (52 fatura) — **bakım 5'in Y5-7 ile kalkan 190 denetiminin 0'ı geri kazanıldı** (hepsi KS8 × S98; karar yok — Y6-10) · tanım alanı dışı 69 → 69 (KS9 59, KS8 9, karşı yönlü
  kalemli kartlı cari 1 — karar yok) · C13.4 (11) 2 → 2 (Mevcut Borç kartı birden çok kalemi tüketti 1, taksitli faturanın iadesi 1).
- **Yeni elle kümede (d25–d33, 47 cari-kesim; `kahineski6-susan-say-yeni-elle-*`):** EK-2B 32 12 → 2 (Q6 kart borçtan büyük, Q7 iadeyle kapanmış — S101 kurulmaz) + SK-14 0 → 1 (Q5) · belge SK-13
  5 → 0 · Y5-7 4 → 1 (G2 — KS8) · okumalar ayrışıyor 9 → 1 (T17 — SK-17) · taksitli + karşı yönlü 1 → 1 (P5 — artık SK-15 ile faturaların belge durumu da yazılmaz).
- `--kural 2.4.9` / 2.4.6 / 2.4.5 / `--legacy`: **428/428 bayt bayt aynı** (87 elle — 80 eski + 7 bakım 6 — ve 20 rastgele × 4 kip); üretici 20/20 aynı dizi; eski elle senaryoların adımları değişmedi.
- **Yeni / değişen elle tablolar ESKİ (bakım 5) kâhinde — beklenen NEDENLE kırmızı (ders 7, 38):** 335 elle denetimin 165'i (d25 3, d26 48, d27 18, d28 9, d29 9, d30 30, d31 10, d32 10, d33 28;
  dökümü `kahineski6-kirmizi-eski-cari-*.log`): eski kâhin SK-9 … SK-13 carilerinde susuyor ("ANAHTAR YOK" — d26 S9–S13, d25 R3, d33 T10c / T11b / T11c / T12b / T13c), taksitli faturalı + verilen
  avanslı caride Y5-7 ile susuyor (d27 / d28 / d29 P3) ve taksitli carinin açık toplamını yazmıyor (P1 / P2 / P4a), avansla kapanmış borca açılan kartlı carilerde EK-2B 32 ile susuyor (d30 Q1–Q4,
  Q8a; d31 / d32), SK-15 carisinde faturaların belge durumunu yazıyor (P5F 90.000, P5A 40.000) ve yeni `belirsiz` kayıtları (SK-14, SK-15, SK-17) yok. Kalan 170'i iki kâhinde aynı (bakiye, kart
  tutarı, Q6 / Q7 susmaları, tek yönlü cariler, taksitli faturanın S99 örneği — §13'ün kuyruğu zaten A'yı veriyordu).

### Kanıt (bakım 6; iki saat dilimi — UTC ve Europe/Istanbul çıktıları bayt bayt aynı; kâhin `9af62b3a`, araçlar `92ba2471` (sayım aracı düzeltmesi `f909a0f5`), temiz ağaç; `docs/kanit/2026-11-10/kahineski6-*`, araçlar `kahineski6-arac/`)
cari öz test **3.607/3.607** (`-cari-oz-*`: elle tablolar 87 senaryo, mutantlar 200–250 — 219–250 değerle, saf TYK 173 kalem, bakım 4–6 çapraz denetimi: saf net 138 kalem karşı yönlü kalemli
caride + 576 tek yönde (26 taksit), saf belge durumu 94 fatura, avans 270 cari, (ii) 328, gecikmiş (i) 419; susulan okuma ayrışan 1 (SK-17), tanım alanı dışı 21; S98 ile kendi tarafından ayrışan
21 cari) · defter öz test **171/171** (defter DEĞİŞMEDİ) · mutasyon taraması **217/217** (`-cari-mutasyon-*`; kos.mjs düzeni, 87 dosya × kipler) · eşdeğerlik + G3 **529/529** (`-esdeger-cari-*`) ·
yeni / güncellenen elle tablolar **335/335** (`-elle-yeni-cari-*`) · ESKİ kâhinde **165 kırmızı** / 335 (`-kirmizi-eski-cari-*`) · geniş tarama **2.201/2.201** (`-genis-tarama-*`: s1 tohum 1–30 × 120,
390 kontrol kesimi — saf net 677 + 516, saf belge durumu 386, tek yön = kendi tarafı 1.750, (ii) 420, gecikmiş (i) 513; susulan: okuma ayrışan **0** (bakım 5: 30), tanım alanı dışı 215 — aynen) ·
susulan sayımı **1/1** + **1/1** (`-susan-say-*`, `-susan-say-yeni-elle-*`). Mutasyon, eşdeğerlik, geniş tarama ve susulan sayımı `flock -s -n …/olcum.lock` ile koşuldu (ders 52). Program
açılmadı.

## 19. 2.5.0 Ç5 bakımı 7 — senaryo düzeni (G1) ve satışla birlikte açılan kart (G2) (10.11.2026, `date -u` 23:27; girdiler 10.11.2026 — ana oturumun özet dosyası; eski kâhinler bakımı 7 — kodu görmeyen AYRI el) — kural seti `2.5.0` = §13 + … + §18 + bu bölüm

Bu bakım KÜÇÜKTÜR: kâhinin para / görünüm kuralları (§13–§18) DEĞİŞMEZ. İki girdi programın ADIM KABUL kurallarıdır (hangi girişi kabul eder / reddeder): G1 bir senaryo düzeni sorunudur (beklenen
değer değişmez), G2 bir adım türü ekler ve elle "Carinin Mevcut Borcunu Taksitlendir" kartının kabul koşulunu yazar. `--kural 2.4.9` (ve 2.4.6 / 2.4.5 / `--legacy`) AYNEN. Defter kâhini
(`test/bagimsiz/defter/`) DEĞİŞMEZ (ret edilen kart yevmiye yazmaz; satışla açılan kart maddesizdir — C13.2 / kitap H-02). **Bu bölümün ilk commit'i yalnız YORUMDUR (ders 40 — önce kural, sonra
kod); senaryo / mutant / G3 sayıları kod ve kanıt commit'lerinde eklenir.**

### C00l Temiz oda (bakım 7)
- **Girdi (AYNEN; ana oturumun özet dosyası `scratchpad/kahin-eski7-kararlar.md` — "programın hesap / görünüm davranışı hakkında hiçbir bilgi içermez; içerdiği iki madde programın ADIM KABUL
  kurallarıdır … ve kullanıcının / baş mimarın kararıdır"):**
  - "G1 — Fatura adımlarının sırası (mevcut ürün kuralı; 2.4.x'ten beri): Program aynı fatura serisinde belgeleri TARİH SIRASIYLA kabul eder: seride son kaydedilen belgeden DAHA ESKİ tarihli
    yeni belge reddedilir ('numara ve tarih sırası uyuşmalı'). Bir senaryoda bütün fatura (ve seriden numara alan iade) adımları, hangi cariye ait olursa olsun, tarih sırasıyla (eşit ya da artan)
    girilmelidir. Bakım 6'nın S99 senaryoları (d27, d28, d29) faturaları cari cari giriyor … → program o adımları reddediyor. Bu bir SENARYO düzeni sorunudur; kâhinin kuralı ve beklenen
    değerleri bununla DEĞİŞMEZ."
  - "G2 — … (BAŞ MİMAR KARARI 10.11.2026; kullanıcıya gösterildi) KARAR (iş listesi D, 10.11 — AYNEN özü): müşterinin borcu avansla kapanmışken ELLE 'Carinin Mevcut Borcunu Taksitlendir' kartı
    açılamaz — bu yol bugünkü gibi REDDEDİLİR (mevcut kural: kart tutarı carinin taksitlendirilebilecek borcundan büyük olamaz; taksitlendirilecek borç yoksa kart açılmaz). S101 = A yalnız kartın
    SATIŞLA BİRLİKTE açıldığı yolda oluşur: stoktan veresiye satış yapılırken aynı işlemde taksitlendirme (kullanıcının S101 örneği de budur: 'stoktan 600 veresiye satış + 2 taksit'). Gerekçe:
    borcu kalmamış müşteriye elle 'Bitti' kart açtırmak kullanıcıyı yanıltır." · "Sonuç: bakım 6'nın S101 senaryoları (d30, d31, d32) kartı ayrı bir 'mevcut borç kartı aç' adımıyla açıyor →
    program o adımı reddediyor, sonraki kart tahsilatı adımları da karşılıksız kalıyor."
  - S101 karar metni aynı dosyada §18 C00k'daki metinle AYNI (değişmedi).
- **Birlikte okunan (kâhinin kendi belgeleri ve kural kitabı):** bu dosyanın §5, §8 C9, §9 KS7 / KS7.1, §10 dil ekleri (`kart_ac`), §13 (C13.2, C13.4 (1)–(11)), §18 (Y6-3, Y6-4, Y6-5, SK-14, SK-16, C18.x,
  senaryo listesi); `docs/erp/MUHASEBELESTIRME-KURAL-KITABI-EK-2B.md` başlık, §0 özet, madde 32, 35, §4, §5, §6; `…-EK-1.md` §1 adım 1–4 (satır 52–63); `…-EK-2.md` Soru 30 ve 32 (satır 128–155);
  kural kitabı H-02 satırı ve EK'lerde "Mevcut Borç / taksitlendir" araması. Okunan / okunmayan dosyaların tam listesi (satır aralıklarıyla) ajan raporunda.
- **Okunmayan:** `server/**`, `client/**`, `bulut/**`, `packaging/**`, `tools/**` (yalnız `kanit.mjs` çalıştırılır), `docs/erp/C5-ACILIS-TASARIM.md`, `docs/erp/C5B-TYK-TASARIM.md`, `docs/devir/**`,
  `docs/2.5.0-IS-LISTESI*.md` (hiçbir sürümü), `test/bagimsiz/cari/YAPIM-ASAMASI.json`, iki kâhin klasörü dışındaki `test/**`, git farkı / geçmiş içeriği. `kos.mjs` yalnız eşleme için okundu (satır
  540–650 adım eşlemeleri: `kart_ac`, `kart_tahsilat`, `fatura`, `iade`; arama satırları 14, 71, 152–154, 177, 288, 368, 388, 603–640, 737–760, 921) — alış faturasının koşucuda kendi `number`'ıyla
  gönderildiği, satış ve iadenin numarasız (seriden) gittiği buradan; kural türetilmedi. `docs/kanit/` altında yalnız `kahineski4|5|6-arac/` araçları açıldı; ana oturumun
  `docs/kanit/2026-11-10/kahineski6y-kos.sh.txt` dosyasının ilk 5 satırı (yol tanımları) bir listeleme komutunda yanlışlıkla ekrana geldi — kullanılmadı. Program koşulmadı; programın davranışı
  aranmadı. CLAUDE.md "Açık iş"teki program durumu kural / beklenti kaynağı sayılmadı.

### Yorumlar (ders 40 — girdilerden; kod yazılmadan ÖNCE; baş mimar kullanıcıya gösterir)
- **Y7-1 — G1 senaryo düzeni (kural değil):** "seriden numara alan" belge = satış faturası (`fatura`, `tur` ≠ `alis`; taslak dahil — taslağın numarayı ne zaman aldığı bilinmediğinden en sıkı
  okuma) ve `iade` (satıştan iade belgesi). Alış faturası satıcının numarasıyla girilir (koşucu her alışa kendi `number`'ını verir) → seriye girmez; yine de "alış dahil" sıkı tarama BİLGİ olarak
  raporlanır. Belgenin tarihi = adımın `tarih`'i, yoksa senaryonun `bugun`'ü (koşucunun kuralı). Senaryo içinde bu adımların tarihleri eşit ya da artan olmalı (§5'in "Geçerlilik: aynı seride
  fatura tarihleri artan" kuralı elle senaryolarda da ZORUNLU; öz denetime eklenir). **Düzeltme yöntemi:** yalnız adımların YERİ değişir — her carinin kendi adımlarının göreli sırası, `cari_ac`
  adımlarının göreli sırası ve `kontrol` adımlarının yeri korunur; tutar, tarih, ad, elle beklenen değer DEĞİŞMEZ. **Koşul:** kâhinin o senaryo için ürettiği bütün çıktı (denetimler değer + etiket +
  kural metni ve `belirsiz`) beş kipte (2.5.0, 2.4.9, 2.4.6, 2.4.5, `--legacy`) önce / sonra bayt bayt aynı; aynı çıkmazsa DURULUR (o zaman sıra kural meselesidir). Gerekçe: kâhinde cariler
  birbirinden bağımsızdır, aynı gün sırası yalnız aynı carinin olayları arasında anlamlıdır (ders 31); farklı carilerin adımlarının araya girmesi bir carinin kuyruğunu değiştirmez.
- **Y7-2 — G2 (a) yeni adım "satışla birlikte açılan kart" — `stok_satis_taksit {ad, cari, tutar, tarih, taksit, ilkVade}`:** stoktan veresiye (açık hesap) satış + AYNI işlemde o satışın taksit
  kartı ("Bu satışı taksitlendir"in stok satışındaki karşılığı). Alanlar `stok_satis_hesap {cari, tutar, tarih}` ve `kart_ac {ad, cari, tutar, taksit, ilkVade, tarih}` ile aynı adlarla: `ad` kartın
  adı (çıktı `kart:<ad>:*`, `kart_tahsilat {kayit: <ad>}`), `tutar` satış tutarı = kart tutarı (peşinatsız — kararın örneği "600 veresiye satış + 2 taksit"), `tarih` satışın ve kartın günü,
  `taksit` taksit sayısı, `ilkVade` ilk taksit tarihi (taksitler eşit, artık kuruş sonda, ilk vadeden ayda bir — [YAYGIN], `kart_ac` ile aynı varsayım). Kâhindeki anlamı:
  1. Satış KS7.1'deki stok veresiye satışıyla aynı borç kalemidir (belge günü = vade = `tarih`; C13.4 (1)); kart hemen ardından (aynı gün, yazım sırasıyla satıştan sonra) açılır ve KENDİ satışını tüketir
     (C13.4 (6) "Bu Satışı Taksitlendir kendi faturasını tüketir" ve EK-1 §1 adım 2 "'Bu Satışı Taksitlendir' → o fatura" ilkesi; S101 "o satış için taksit kartı"). Kart ile satış birlikte sayılmaz;
     kuyrukta yalnız kartın taksitleri kalır (M1e).
  2. Bekleyen bağsız alacak (avans) satış doğduğu anda onu kapatır (C13.4 (4) ANINDA); kart satışın açık kısmını tüketir, satışın AVANSLA (bağsız PARA — Y6-4) kapanmış kısmı kartın ÖDENMİŞ kısmıdır
     ("avans satışı kapatmıştır, kart 'Bitti' görünür"), vadesi en önce gelen taksitten — **S101 A / Y6-4 / Y6-5 (R1 / R2, SK-14) bu kartta AYNEN**. Kart tahsilatı kartın açık taksitine, kalmadıysa
     carinin avansına; sonraki borç avanstan kapanır.
  3. Satış avans DIŞI bağsız alacakla (stok / fatura iadesinin artanı, Değersiz Alacak) kapanmışsa Y6-4'ün "AVANSLA" sınırı AYNEN: EK-2B 32 tanımsızlığı (C13.4 (11)).
  4. Adım her durumda KABUL edilir (girdide bu yol için ret koşulu yok; kart kendi satışından büyük olamaz). Yevmiye: stok satışı (mizan zaten denetlenmez — stok adımı), kart maddesiz (C13.2, H-02).
     Programın bu kartı hangi türle işaretlediği bilinmiyor → `kart:<ad>:mevcutBorc` YAZILMAZ (`var`, `toplam`, `odenen`, `kalan`, `taksitN:odenen` yazılır).
  5. **Kâhinin kurmadığı (susar — kural sorusu DEĞİL, kâhinin sınırı):** satış kartının açıldığı anda ya da kontrol anında carinin kendi satışı DIŞINDA açık (kalanı > 0) borç kalemi varsa (başka
     fatura / Borç / Açılış / stok satışı / taksit) — kâhinin K6.5 görünüm hesabı (takvim / Vade Takip tutarı = Kalan − kartın açık kapsamı) kartın carinin elle kaydını kapsadığını varsayar; satış kartı
     stok satışını kapsar. O carinin kalan / açık / kart / görünüm denetimleri C13.4 (11) düzeninde yazılmaz (neden "… satışla açılan kart … öbür açık borç (bakım 7 Y7-2)"). Kartın açıldığı anda başka
     açık borç YOKKEN kart yalnız kendi satışından tüketebilir (sonradan doğan kalemi tüketemez) — "kendi satışı" ile "kuyruk sırası" o alanda aynı sonucu verir.
- **Y7-3 — G2 (b) elle "Carinin Mevcut Borcunu Taksitlendir" kartının kabulü (yalnız `2.5.0`):** Taksitler'den `kart_ac {mevcut: true}`, tutarı > 0. Kart tutarı carinin **taksitlendirilebilecek
  borcundan** büyükse ya da taksitlendirilecek borç yoksa adım REDDEDİLİR (`adim:<id>:durum` "ret"; kart oluşmaz — `kart:<ad>:*` yazılmaz; sonraki `kart_tahsilat {kayit: <ad>}` "ret", kartı olmayan
  kayda kart tahsilatı girilemez — mevcut kural; Kasa ve bakiye değişmez). Eşitlik (kart = taksitlendirilebilecek borç) KABUL ("büyük olamaz"). Sıfır kart (C1.5 S2 A), Yeni Borç kartı
  (`mevcut: false`), Tablodan Aktar'ın mevcut borç kartı (B1.4 kendi kuralı) ve satışla açılan kart (Y7-2) bu kurala GİRMEZ. Sonuç: Y6-4'ün "avansla kapanmış borca açılan Mevcut Borç kartı"
  dalı ve EK-2B 32 tanımsızlığı elle kartta artık oluşmaz (ret) — yalnız aşağıdaki iki okumanın ayrıştığı sınırda (SUS) ve satış kartında (Y7-2 (3)) kalır. **"Taksitlendirilebilecek borç"un
  tanımı ne bu dosyada ne kural kitabında yazılı** (kitap: EK-2B 32 "kart hiçbir zaman alttaki borcun üstünde kalmaz"; EK-1 §1 adım 2 "'Carinin Mevcut Borcu' → açık borç kalemleri"; kılavuz — EK-2 Soru
  30 / 32'de aktarılan — "Carinin Mevcut Borcu (tutar bakiyeden gelir) … tutarı sonradan büyütülmez", EK-2 S.32 "kartın borçtan büyük olmasının olağan yolu bakiyenin şüpheli kısmıdır") → iki okuma:
  - **OK — kalem okuması:** kartın tarihinde (aynı gün yazım sırasıyla) carinin kuyruğunda açık olan ve M1e'nin tüketebileceği borç yönlü kalemlerin toplamı (C13.4 (6); karşı yönlü kalemle netleşmez,
    verilen avansı saymaz, kartın gününden sonra tarihli kalemi saymaz).
  - **OB — bakiye okuması:** kart girildiği anda carinin borç bakiyesi (bütün kayıtlarıyla; şüpheli kısım dahil) eksi öbür etkin taksit kartlarının ve taksitli faturaların AÇIK taksitleri (zaten
    taksitlendirilmiş kısım).
  Tek yönlü (karşı yönlü kalemi, verilen avansı, şüphelisi, başka kartı / taksitli faturası olmayan), kayıtları kart gününe kadar tarihli caride iki okuma AYNIDIR (avans ANINDA kapattığından açık
  kalemlerin toplamı = max(0, bakiye)). İki okumanın kabul / ret kararı ayrışırsa kâhin **SUSAR**: adımın durumu ve iki dünyada (kart kabul / kart yok) farklı çıkan her denetim yazılmaz; `belirsiz`
  "… KULLANICIYA SORULMALI SK-18 (§19)". (Karar ayrışmıyorsa — ör. kart iki okumanın da altında — kabul / ret yazılır.)
- **Y7-4 — S101'in kâhindeki yeri (G2 × §18):** S101 A (Y6-4 / Y6-5) kural olarak AYNEN; girdi "S101 = A yalnız kartın SATIŞLA BİRLİKTE açıldığı yolda oluşur" dediği için elle yolda erişilmez (ret).
  Bakım 6'nın d30–d32'si satışla açılan kartla yeniden yazılır; elle yolun reddi ayrı satırlarla denenir. Q6 (kart, satışın açık + avanslı kısmından büyük) satışla açılan kartta KURULAMAZ (kart tutarı =
  satış tutarı) → elle yolun reddi satırına döner.
- **Y7-5 — SK-16 (bakım 6) × G2 (b):** SK-16'nın örneği (müşteriye Ödeme 200 · Borç 500 · Mevcut Borç kartı 700) artık önce bir KABUL sorusudur: OK ret (açık yükümlülük 500 < 700), OB kabul
  (bakiye 700) → SK-18'in bir örneği; kâhin o carinin adımında da susar (SK-16'nın sorusu kart kabul edilirse anlamlı kalır — aynen açık).

### KULLANICIYA SORULMALI (bakım 7; kâhin bu durumda SUSAR — ders 43, SORU DÜZENİ; UÇ DURUM)
- **SK-18 (G2 (b) — "taksitlendirilebilecek borç"):** aynı kişi hem müşteri hem tedarikçi (ya da müşteriye avans vermişiz, ya da başka taksit kartı var); "Carinin Mevcut Borcunu Taksitlendir" kartının
  üst sınırı hangisi? Örnek: 01.05 satış faturası 600 · 02.05 aynı kişiden alış faturası 300 · 05.05 Carinin Mevcut Borcu kartı 600 (2 taksit). **A (öneri — kılavuz "tutar bakiyeden gelir"):** sınır
  carinin net borç bakiyesi (eksi zaten taksitlendirilmiş kısım) — 300; kart 600 reddedilir, 300'lük kart açılır / **B:** sınır açık borç kalemleri (alış ayrı yükümlülük, Mahsup Et ile kapanır) — 600;
  kart açılır / **C:** uç durum böyle kalsın (BİLİNEN SINIR).

### Kurallar (kod commit'i; yorumların `model.py`'deki karşılığı)
- **C19.1 (Y7-1) senaryo düzeni:** d27 / d28 / d29'un adımlarının YERİ değişti (araç `docs/kanit/2026-11-10/kahineski7-arac/g1-sirala.py`: kontrol adımları ve carisi çözülemeyen adımlar yerinde; arada
  `cari_ac`'lar önde, öbür adımlar cari kuyruklarından tarihle birleştirilerek); tutar / tarih / ad / elle beklenen değişmedi. `oz-test.py` 8: bütün elle senaryolarda satış faturası (taslak dahil) + iade
  tarih sırasıyla. `uretici.py` DEĞİŞMEDİ (fatura / iade tarihlerini sıralı üretiyor — kanıtta ölçüldü).
- **C19.2 (Y7-2) `stok_satis_taksit`:** `_kapatici(…, "stok_satis")` (KS7.1 kalemi) + `kart_ac({…, mevcut: true, _satis_kart})`; kartın `satis` = adımın kimliği (satış kalemi). `_tyk`'ta satış kartının
  tüketimi YALNIZ kendi satışından (`hedef_`; mutant 255: kuyruk sırasıyla), S101'de karşılanabilir tutar = kendi satışının AVANSLA kapanmış kısmı (mutant 252: S101 B yalnız satış kartında; 243
  aynen). `_alacak_govde250` Y7-2 (5) nedeni: satış kartlı caride başka (satış kartı olmayan) Mevcut Borç kartı ya da kuyrukta açık elle kayıt / taksitsiz satış faturası / karşılıksız kalemi →
  C13.4 (11) tanımsız. `kontrol` satış kartında `mevcutBorc` yazmaz. `C1_YAZIM`'a eklendi (silinmiş cariye yazım reddi C1.6 aynen).
- **C19.3 (Y7-3) elle `kart_ac {mevcut}` (yalnız `2.5.0`, tutar > 0, satış kartı değil):** `_g2b_okumalar` (OK: kart denenerek açılır, S101'siz kuyrukta kartın eksiği yoksa kabul; OB: kartsız kuyruğun
  açık taksitleri düşülmüş bakiye ≥ tutar — kartsız kuyruk C13.4 (11) tanımsızsa ya da cari şüpheli kayıtlıysa okunamıyor). İkisi ret → `("ret", "BAŞ MİMAR", "C19 Y7-3 …")`, kart silinir;
  ayrışır ya da OB okunamıyorsa kart kabul edilmiş sayılır ve `sus_kart`'a yazılır: `kos()` sonunda adımsız senaryo da koşulur, iki dünyada farklı çıkan ya da yalnız birinde olan her denetim
  silinir, `belirsiz` "… SK-18 (§19)". Mutantlar 251 (ret yok), 253 (eşitlikte ret), 254 (1 kuruş aşan kabul). `yedek_al` kopyası `sus_kart`'ı taşımaz (adım kaydı).
- `--kural 2.4.9` / 2.4.6 / 2.4.5 / `--legacy`: hiçbir yol değişmedi (yeni dallar `k250` ya da mutant). Yeni adım ≤ 2.4.9 kiplerinde de stok satışı + kart olarak işlenir (eski kâhinde adım yok —
  eşdeğerlik o üç dosyanın ESKİ hâlleriyle ölçüldü).

### C8l Nasıl bozulur? (bakım 7 — kod commit'inde, senaryolarla birlikte yazıldı)
| # | Bozulma | Senaryo |
|---|---|---|
| Z92 | Fatura adımları cari cari girilir — seride eski tarihli belge (program reddeder; beklenenler boşa düşer) | d27 / d28 / d29 (oz-test 8) |
| Z93 | Avansla kapanmış borca ELLE Mevcut Borç kartı açılır ("Bitti") | d30 Q6, QR1 (mutant 251) |
| Z94 | Kart açık borçtan büyükken kabul / eşitlikte ret | d30 QR2, QR3, QR4; d4 KM / KP, d7 KE (eşitlik) (mutantlar 251, 253, 254) |
| Z95 | Reddedilen kartın tahsilatı kabul edilir (Kasa'ya girer, bakiye düşer) | d30 QR1 `qr1k` |
| Z96 | İadeyle kapanmış (borcu kalmamış) cariye elle kart açılır | d30 QR5 |
| Z97 | Satış kartında S101 B (kart kendi borcunu taşır, avans serbest) ya da ödenmiş kısım son taksitten | d30 Q1–Q4, Q8; d31 / d32 (mutantlar 252, 243, 244) |
| Z98 | Satış kartı kendi satışı yerine başka kartın vadesi geçmiş taksitlerini tüketir | d30 Q9 (mutant 255) |
| Z99 | Kalem / bakiye okuması ayrışırken kâhin kabul ya da ret uydurur | d30 QS (SK-18) |
| Z100 | İade alacağıyla kapanan satışın kartı "Bitti" sayılır (S101 "AVANSLA") | d30 Q7 |
| Z101 | Aynı adlı iki carinin avansı birbirinin satış kartına sayılır | d30 Q8 |

### Senaryolar (bakım 7; elle tablolar — kâhin koşulmadan girdilerden ve §18 / §19'dan elle; betik `docs/kanit/2026-11-10/kahineski7-arac/yeni-senaryolar7.py`, değerler betikte elle. İLK koşuda 178 elle denetimin hepsi kâhinle aynıydı)
- **d27 / d28 / d29:** yalnız adımların yeri (C19.1); elle tablolar AYNEN (43 + 17 + 17).
- **`d30-c5-s101-bitti-kart`** (bugün 15.06; 136 = 107 değer + 26 yok + 3 belirsiz): satış kartıyla Q1 (kararın örneği), Q2, Q3, Q4, Q5 (SK-14), Q7 (iade alacağıyla kapanmış satış — EK-2B 32), Q8 (aynı
  ad), Q9 (iki satış kartı — kendi satışı); ELLE yol Q6 (borç tamamen avansla kapanmış, kart > satış → RET), QR1 (tamamen avanslı, kart = satış → RET; sonraki Taksit Tahsilatı RET, Borç avanstan),
  QR2 (kısmen kapanmış, kart 600 > açık 200 → RET), QR3 (kart = açık 200 → KABUL), QR4 (200,01 → RET), QR5 (iadeyle kapanmış → RET); QS SK-18 (susar).
  **Bakım 6'dan:** 50 değerin 48'i AYNEN; 2'si YOK'a döndü — `kart:KQ1:mevcutBorc` (satış kartında yazılmaz, Y7-2 (4)), `kart:KQ6:toplam` (Q6 elle yolda RET, Y7-3 / Y7-4); 9 yokun 8'i AYNEN
  (`kart:KQ6:odenen` kalktı — kart yok); 3 belirsizin 2'si AYNEN (SK-14, Q7 EK-2B 32), Q6'nın EK-2B 32'si kalktı (RET). Değeri değişen 0. Yeni 59 değer + 16 yok + 1 belirsiz (SK-18).
- **d31 / d32** (bugün 01.07 / 02.07; 21 = 19 değer + 2 yok): bakım 6'nın 14 değeri AYNEN (Q2 / Q4 satış kartıyla) + 3 adım durumu + 2 `kart:var`; yok: iki kartın `mevcutBorc`'u.

### C10l Mutantlar (bakım 7; `oz-test.py` DEĞERLE — çökmeden, elle tablo kırmızı)
251 G2 (b) kalkar (elle kart açık borçtan büyükken / borç yokken kabul — bakım 6 davranışı) · 252 S101 B satış kartında · 253 sınır: kart = borç da ret · 254 sınır: 1 kuruş aşan kabul · 255 Y7-2 (1) B:
satış kartı kuyruk sırasıyla tüketir. Bakım 6'nın 241–250'si aynen; 243 / 244 artık satış kartıyla (d30–d32) yakalanır.

### Dil ekleri (/3, bakım 7)
Yeni adım `stok_satis_taksit {ad, cari, tutar, tarih, taksit, ilkVade}` (Y7-2). `kart_ac {mevcut: true}` 2.5.0'da `ret` dönebilir (Y7-3). Yeni çıktı anahtarı YOK (satış kartında `kart:<ad>:mevcutBorc`
yazılmaz). Yeni `belirsiz` kayıtları: "adım <id>: … SK-18 (§19)", C13.4 (11) nedeni "satışla açılan kart … (bakım 7 Y7-2 (5))".

### Eşleme notları (ana oturum için; `kos.mjs` bu bakımda DEĞİŞMEDİ — yeni adımın eşlemesini ana oturum ekler)
- **`stok_satis_taksit`:** stoktan açık hesap (veresiye) satış + AYNI işlemde taksitlendirme (taksit sayısı `taksit`, ilk vade `ilkVade`, ayda bir; tutar = satış tutarı = kart tutarı; tarih `tarih`).
  Kartın kimliği `ids.kart[a.ad]`'a yazılmalı (`kart_tahsilat {kayit: <ad>}` bugünkü eşlemesiyle onu kullanır); satış `stok_satis_hesap` ile aynı stok hareketi sınıfında. Kart anahtarları `kart:<ad>:{var,
  toplam, odenen, kalan, taksitN:odenen}` (bugünkü kart okumalarıyla); `mevcutBorc` kâhinde yok. Programın ucu / alan adı bu ajanca bilinmiyor.
- **Reddedilen `kart_ac`:** `durum` "ret" (HTTP 4xx) beklenir; kart kimliği yok → sonraki `kart_tahsilat` "ret" beklenir (koşucu kimlik yokken tablo aramasına düşüyor — satır 589–592; ana oturum
  bunun "ret" ürettiğini doğrulasın). SK-18 susan adımın `adim:<id>:durum`'u kâhinde yok.
- **Ana oturuma:** `model.py` değişti — mobil yazma kâhininin `cari_model_sha256`'sı yeniden üretilmeli (o dosya okunmadı); yapım aşaması listesi bu ajanca açılmadı.

### C12l DENENMEYEN (bakım 7; neden)
- Program koşulmadı (görev). Satışla açılan kartın programdaki ucu / gösterimi bilinmiyor.
- SK-18'in öbür örnekleri (verilen avans — SK-16, başka kart / taksitli fatura, kartın gününden sonra tarihli kayıt, şüpheli kayıt) elle senaryo yazılmadı; susma mekanizması QS'de (karşı yönlü kalem) denendi.
- Y7-2 (5) (satış kartı + başka açık borç / başka Mevcut Borç kartı) — kâhin susar; değer kurulmadı (Q5'te SK-14 ile birlikte geçiyor).
- Tablodan Aktar'ın mevcut borç kartı G2 (b)'ye girmez (B1.4) — yeni senaryo yazılmadı; satış kartında peşinat (kart < satış), satış kartı silme / geri yükleme, taksitli stok satışının iadesi
  (2B-S3 / Ç7b) — kararda / dilde yok.
- G1: defter kâhininin senaryoları bu bakımın kapsamı dışında, değiştirilmedi (bilgi: `test/bagimsiz/defter/senaryo.json`'da satış / iade belgeleri tarih sıralı; yalnız kendi numaralı alış F12
  geriye tarihli — alış seriye girmez).

### C0l Değişen eski beklentiler (G3; bakım 6 `a0d8342a` ↔ bakım 7 kâhin çıktısı, `2.5.0`; eski kopyanın 87 elle senaryosu + rastgele s1 / ux18 tohum 1–10 × 120) — kararla ilgisiz eski beklenti DEĞİŞMEDİ
Eski 45.944 → yeni 45.906 denetim; değişen / kalkan / yeni toplam **164**, hepsi G2b sınıfında (yeni kâhinin REDDETTİĞİ elle Mevcut Borç kartının carisi / kartı / adımları ve o karta yazılan kart
tahsilatı) ya da G2b-genel (aynı kontrolde Kasa, Kasa raporu girişi ve sayaçlar); **BEKLENMEYEN 0**, yalnız etiketi değişen 0 (dökümü `docs/kanit/2026-11-10/kahineski7-g3-dokum-*.json`, özet
`kahineski7-esdeger-cari-*.log`; iki saat diliminde bayt bayt aynı):
- **d30 (eski dosya):** G2b değişen 31 · kalkan 44 · yeni 32 · G2b-genel değişen 2 · yeni 2 — bakım 6'nın elle kartları (KQ8B hariç) avansla / iadeyle tamamen ya da kısmen kapanmış borca açılıyordu;
  G2 (b) ile RET (kart anahtarları kalkar, carinin Kalan / gecikmiş / açık toplamı artık yazılır, reddedilen kartın tahsilatı RET — Kasa düşer).
- **d31 / d32 (eski dosya):** G2b değişen 9 / 8 · kalkan 14 / 14 · G2b-genel değişen 4 / 4 (KQ2, KQ4 RET — açık 200 < kart 600).
- **Öbür 84 eski elle senaryo (d27–d29 dahil) ve 20 rastgele: fark 0.** Eski elle Mevcut Borç kartlarının hepsi (c11, d4 KM / KP, d7 KE, d8 KA, d19 KN4) iki okumada da KABUL — değer değişmedi.
- **`--kural 2.4.9` / 2.4.6 / 2.4.5 / `--legacy`:** **764/764** bayt bayt aynı (eski kopyanın 87 elle + yeni kopyanın yeni adımsız 84 elle — yeri değişen d27–d29 dahil — + 20 rastgele × 4 kip);
  yeni adım türünü kullanan d30–d32 (yeni hâl) eski kâhinde koşmadığı için dışarıda, eski hâlleri içeride. Üretici 20/20 aynı dizi. Eski kopyadaki elle senaryolardan yalnız d27–d32'nin adımları değişti.
- **G1:** d27 / d28 / d29 eski ↔ yeni dosya, iki kâhinde (bakım 6 ve 7) beş kipte kâhin çıktısı bayt bayt aynı (**39/39**; sha256 dökümü `kahineski7-g1-dokum-*.json`). Taramada yeni kümede 87/87
  senaryo ihlalsiz; ESKİ kümede 3 ihlalli (d27 5, d28 2, d29 2 adım — testin dişi). Üretici: s1 + ux18 × tohum 1–30 × işlem 120 / 400 = 120 senaryoda seriden numara alan belgede ihlal 0, alış dahil
  ihlal 0, hiçbir tarihli adımda geri giden tarih yok (`kahineski7-g1-uretici-*`).
- **Yeni / değişen elle tablolar ESKİ (bakım 6) kâhinde — beklenen NEDENLE kırmızı (ders 7, 38):** 225 elle denetimin **208**'i (`kahineski7-kirmizi-eski-cari-*.log`): d30 / d31 / d32 eski kâhinde
  koşmuyor (`stok_satis_taksit` adımı yok — 136 + 21 + 21); d30'un elle yol satırları (Q6, QR1–QR5, QS) ayrı senaryoda eski kâhinde 47 denetimin 30'u kırmızı (kartlar RET yerine kabul, kart anahtarları
  var, `qr1k` kabul ve QR1 bakiyesi −200, QR4'te 1 kuruşluk "Bitti", SK-18 kaydı yok); 17'si iki kâhinde aynı (bakiyeler, QR3'ün kabulü).

### Kanıt (bakım 7; iki saat dilimi — UTC ve Europe/Istanbul çıktıları bayt bayt aynı; kâhin `5d35d906`, araç `29e2860d`, temiz ağaç; `docs/kanit/2026-11-10/kahineski7-*`, araçlar ve koşu betiği `kahineski7-arac/`)
cari öz test **3.819/3.819** (`-cari-oz-*`: elle tablolar 87 senaryo, mutantlar 200–255 — 219–255 değerle, saf TYK 173 kalem, bakım 4–6 çapraz denetimi aynen (saf net 138 + 587 kalem, belge 94 fatura),
G1 87 senaryo × 92 belge adımı, Y7-3 reddinin yalnız 2.5.0'da olduğu) · mutasyon taraması **222/222** (`-cari-mutasyon-*`; kos.mjs düzeni, 87 dosya × kipler) · eşdeğerlik + G3 **875/875**
(`-esdeger-cari-*`) · yeni / güncellenen elle tablolar **331/331** (`-elle-yeni-cari-*`: d27–d33) · ESKİ kâhinde **208 kırmızı** / 225 (`-kirmizi-eski-cari-*`) · G1 tarama **87/87**, eski kümede
3 ihlal (`-g1-tara-*`, `-g1-tara-eski-*`) · G1 eşdeğerlik **39/39** (`-g1-esdeger-*`) · üretici G1 **120/120** (`-g1-uretici-*`) · geniş tarama **2.201/2.201** (`-genis-tarama-*`; bakım 6 ile aynı
sayılar) · taşınan / değişen elle değerler dökümü (`-elle-tasinan-*`, bilgi). **Defter öz testi BAŞARISIZ** (`-defter-oz-*`): `test/bagimsiz/defter/oz-test.py` `kahin.py`'de olmayan
`VARSAYILAN_KURAL`'ı arıyor (AttributeError) — TABANDA (`a0d8342a`, bu dalın dokunmadığı dosyalar; `-defter-oz-taban-utc`) de aynı; bu bakım defter kâhinine dokunmadı (ana oturuma bildirildi).
Mutasyon, eşdeğerlik, öz test, geniş tarama ve üretici taraması `flock -s -n …/olcum.lock` ile koşuldu (ders 52). Program açılmadı.

## 20. 2.5.0 Ç5 bakımı 8 — S110 (kart açılırken açık borç kart tutarından fazla: kart KENDİ borcunu taşır) (11.11.2026, `date -u` 06:00; karar 11.11.2026 — ana oturumun özet dosyası; eski kâhinler bakımı 8 — kodu görmeyen AYRI el) — kural seti `2.5.0` = §13 + … + §19 + bu bölüm

Bu bakım KÜÇÜKTÜR: tek kullanıcı kararı (S110), yalnız M1e'nin (C13.4 (6)) "kart hangi borcu içine alır" cümlesini, kart açıldığı anda açık borç kart tutarından FAZLA olduğunda değiştirir.
S2 (vade sırası), S50, S101, S99 ve §13–§19'un öbür kuralları DEĞİŞMEZ. `--kural 2.4.9` (ve 2.4.6 / 2.4.5 / `--legacy`) AYNEN. Defter kâhini (`test/bagimsiz/defter/`) DEĞİŞMEZ (Mevcut Borç
kartı ve satışla açılan kart maddesizdir — C13.2 / kitap H-02; hangi borcun kartın içinde olduğu yevmiyeyi değiştirmez). **Bu bölümün ilk commit'i yalnız YORUMDUR (ders 40 — önce kural, sonra
kod); senaryo / mutant / G3 sayıları kod ve kanıt commit'lerinde eklenir.**

### C00m Temiz oda (bakım 8)
- **Girdi (AYNEN; ana oturumun özet dosyası `scratchpad/kahin-eski8-kararlar.md` — "programın hesap / görünüm davranışı hakkında hiçbir bilgi içermez"):**
  - SORU (iş listesi C — programın bugünkü hâline ilişkin cümle çıkarılmış): "taksit kartı açıldığı anda carinin açık borcu kart tutarından FAZLAYSA kart hangi borcu taşır? Örnek: elle borç 900 +
    fatura F 600 (toplam 1.500), kart 900 (3 × 300) — A (öneri; 2.4.9'daki gibi): kart KENDİ borcunu taşır (stoktan satışta o satışı; elle kartta taksitlendirilen borcu): takvimde 3 × 300 taksit + F 600
    ayrı açık; gecikmiş 900 / B: vade sırası (S2): kart en eski vadeli borçları içine alır — F kartın içinde, elle borcun 600'ü ayrı açık; gecikmiş 900."
  - KARAR (iş listesi D, 11.11 — AYNEN): "S110 = A (para kuralı): taksit kartı açılırken carinin açık borcu kart tutarından FAZLAYSA kart KENDİ borcunu taşır (stoktan satışta o satışı; elle kartta
    taksitlendirilen borcu) — 2.4.9'daki gibi; örnek: elle borç 900 + fatura 600, kart 900 (3 × 300) ⇒ takvimde 3 × 300 taksit + fatura 600 ayrı açık; gecikmiş 900."
  - NOT (ana oturum): "bu karar S2 (vade sırası) ve S50 / S101 kararlarının YERİNE geçmez; yalnız 'kart açıldığı anda açık borç kart tutarından fazla' durumunda kartın hangi borcu içine aldığını
    belirler. 'Elle kartta taksitlendirilen borç'un hangi borç olduğu karar metninden tek okumayla çıkmıyorsa (ör. aynı caride birden çok elle borç, kart tutarı hiçbirine eşit değil) kâhin o sınırda
    SUSAR ve 'KULLANICIYA SORULMALI' yazar (iki seçenek + öneri; uç durumsa üçüncü seçenek 'Uç durum böyle kalsın (BİLİNEN SINIR)')."
- **Birlikte okunan (kâhinin kendi belgesi):** bu dosyanın §13 C13.4 (1)–(11) ve C13.5, §18 (C00k, Y6-4, Y6-5, SK-14, SK-16, C18.4), §19 (C00l, Y7-2, Y7-3, Y7-4, SK-18, C19.2, C19.3, C0l); `model.py` kart
  tüketimi (`_tyk`, `_alacak_govde250`, `kart_ac`, `_g2b_okumalar`, `stok_satis_taksit`) ve K6.5 görünümü (`kontrol` hareket / fatura kalemleri, `_cari_kalemleri`); d4, d7, d30–d32 elle senaryoları.
  Okunan / okunmayan dosyaların tam listesi (satır aralıklarıyla) ajan raporunda.
- **Okunmayan:** `server/**`, `client/**`, `bulut/**`, `packaging/**`, `tools/**` (yalnız `kanit.mjs` çalıştırılır), `docs/erp/C5-ACILIS-TASARIM.md`, `docs/erp/C5B-TYK-TASARIM.md`, `docs/devir/**`,
  `docs/2.5.0-IS-LISTESI*.md` (hiçbir sürümü), `test/bagimsiz/cari/YAPIM-ASAMASI.json`, iki kâhin klasörü dışındaki `test/**`, başka ajanların `docs/kanit/**` dosyaları (yalnız `kahineski7-arac/`
  araçları), git farkı / geçmiş içeriği. Program koşulmadı; programın davranışı aranmadı. CLAUDE.md "Açık iş"teki program durumu kural / beklenti kaynağı sayılmadı.

### Kâhinin BUGÜNKÜ (bakım 7, `60280990`) okuması — S110'un hangi seçeneği (açıkça)
Bakım 7 kâhini kararın örneğinde ne A'yı ne B'yi DEĞER olarak yazıyordu; iki kolda ayrı:
- **Elle "Carinin Mevcut Borcunu Taksitlendir" kartı (`kart_ac {mevcut}`) → B (vade sırası).** C13.4 (6) M1e: kart "kart tutarı kadar açık borç kalemini 2'deki sırayla (v → d → s, S2) TÜKETİR". Bu S110'un B
  seçeneğidir. Ama B'nin sonucu kartın İKİ kalemi tüketmesiyse (kararın örneğinin B düzeni: F 600 kartın içinde + elle borcun 300'ü) C13.4 (7) / (11) "Mevcut Borç kartı birden çok kalemi tüketti" ile
  carinin Kalan / açık / kart / gecikmiş / görünüm denetimleri YAZILMIYORDU (susma). Yani: tüketim kuralı B, örnekte değer yok. Eski kâhinle koşulan iki düzen (kâhinin kendisi — program değil; betik
  `docs/kanit/2026-11-11/kahineski8-arac/eski-okuma.py`): **F önce** (01.03 F 600 · 05.03 Borç 900 vade 10.03 · 15.03 kart 900) → "KA birden çok kalemi tüketti" — yalnız bakiye 1.500, kart tutarı;
  **Borç önce** (01.03 Borç 900 · 05.03 F 600 · 15.03 kart 900) → B'nin ilk kalemi elle borcun kendisi, tek kalem → A ile aynı sonuç: F açık 600, gecikmiş 900, kart kalanı 900, açık toplamı 1.500.
  Kart tutarı tek bir eski kalemle örtüşmeyen her düzende (B kalem sınırını aşınca) susuyordu; eski kalem kart tutarından büyükse (kart 500 · Borç 900 önce · F 600) B değer YAZIYORDU (Borç'un 500'ü kartın içinde).
- **Satışla birlikte açılan kart (`stok_satis_taksit`) → A (tüketim), ama S110 alanında SUSMA.** Y7-2 (1): kart yalnız KENDİ satışını tüketir (mutant 255 = B). Fakat Y7-2 (5) "kartın açıldığı anda ya da kontrol
  anında carinin kendi satışı DIŞINDA açık borcu varsa" o carinin denetimlerini yazmıyordu — S110'un tanım alanı (açık borç > kart tutarı = başka açık borç var) tam olarak bu susma alanıdır. Y7-2 (5)
  bunu "kural sorusu DEĞİL, kâhinin sınırı" diye yazmış ama aynı paragrafta "'kendi satışı' ile 'kuyruk sırası' o alanda aynı sonucu verir" demişti (yalnız başka açık borç yokken) — başka açık borç
  varken iki okuma ayrışıyordu; S110 bunu kapatır.

### Yorumlar (ders 40 — karardan; kod yazılmadan ÖNCE; baş mimar kullanıcıya gösterir)
- **Y8-1 — tetik (S110 "FAZLAYSA"):** kartın açıldığı anda (kartın tarihi, aynı gün yazım sırasıyla — C13.4 (6)) M1e'nin tüketebileceği açık borç yönlü kalemlerin toplamı O (kuyruk kalanları: taksitsiz
  satış faturası, elle Borç, borçlu Açılış, stok veresiye satışı, karşılıksız borç kalemi, öbür kartların / taksitli faturaların açık taksitleri; kartın kendi taksitleri hariç; karşı yönlü kalemle
  netleşmez) kart tutarı T'den **büyükse** (O > T) S110 uygulanır. O = T: kart bütün açık borcu tüketir, A ile B aynıdır — **eski kural AYNEN** (kararın tetiklenmediği sınır). O < T: S110'un alanı
  değil — elle kartta G2 (b) (Y7-3) kabul / ret, satış kartında S101 (Y6-4 / Y7-2 (2)) ve EK-2B 32 AYNEN. 1 kuruş fazlası da "fazla"dır.
- **Y8-2 — satış kolu ("stoktan satışta o satışı"):** kart kendi satışını tüketir (Y7-2 (1) aynen; S110 bunu KULLANICI kuralı yapar). Kartın KAPSAMI artık kararlıdır: kart yalnız kendi satışını
  kapsar, öbür açık borç kalemleri kuyrukta kendi kalanlarıyla kalır. Bu yüzden **Y7-2 (5)'in "öbür açık borç" susması KALKAR** — hem kart açıldığı anda hem kontrol anında (sonradan doğan borç da
  kartın kapsamında değildir). Görünüm: öbür kalemlerin takvim / Vade Takip / projeksiyon tutarı = kuyruk kalanı (C13.4 (7) son cümlesi); kart kapsamı yalnız kendi satışından düşülür. **Kalan:**
  Y7-2 (5)'in "başka Mevcut Borç kartı" kolu (aynı caride satış kartı + elle Mevcut Borç kartı) AYNEN susar — iki kartın birbirinin taksitlerine dokunup dokunmadığı S110'un sorusu değil (bakım 9'a).
- **Y8-3 — elle kol ("elle kartta taksitlendirilen borç") — tek okuma alanı:** kart adımında borcun kimliği yok (kart yalnız cari + tutar + taksit); "taksitlendirilen borç" karardan iki işaretle okunur:
  **(i) tutar** — kartın tutarı o borcun açık tutarıdır (kararın örneği: kart 900 = elle borç 900); **(ii) tür** — elle kartın taksitlendirdiği borç carinin ELLE kaydıdır (Borç Yaz ya da borçlu Açılış;
  örnek "elle borç 900" ↔ "fatura 600 ayrı açık"; satışın kendi yolu "stoktan satışta o satışı" ayrı yazılmış). **Tek okuma:** kart anında açık tutarı T'ye EŞİT TEK kalem var ve o kalem elle kayıt →
  kart YALNIZ o kalemi tüketir (tamamen; tek kalem — C13.4 (7) defter kalanı tanımlı). Öbür her durumda (iki işaret ayrışıyor ya da kalem tek değil) kâhin **SUSAR** (C13.4 (11) düzeninde o carinin
  Kalan / açık / kart / gecikmiş / görünüm denetimleri yazılmaz; `belirsiz` "… S110 … KULLANICIYA SORULMALI SK-19 (§20)"). Susulan sınırlar (sayılar SK-19'da):
  (a) eşit kalem yok, birden çok elle borç (NOT'un örneği); (b) eşit kalem elle kayıt değil (fatura, stok satışı, karşılıksız, başka kartın taksiti); (c) eşit kalem yok, tek elle borç kart tutarından
  büyük (kart elle borcun bir parçasını mı taşır?); (d) açık tutarı T'ye eşit birden çok kalem.
- **Y8-4 — kartın tükettiği kalem ve görünüm (elle kol, tek okuma):** kalemin defter kalanı (Kalan / fatura açığı) C13.4 (7) / K6.5 (a) AYNEN = kuyruk kalanı + (tüketilen − kartın ödenen kısmı);
  takvim / Vade Takip / projeksiyon tutarı = kuyruk kalanı (kartın tükettiği kalem 0 — taksitleriyle bir kez); kartın tüketmediği kalemler (kararın "fatura 600 ayrı açık"ı) kuyruk kalanıyla takvimde
  (fatura kalemi de: K6.5'in "kartlı caride fatura kalemi yazılmaz" sınırı S110 alanında kalkar — fatura kartın kapsamında değil). K6.5'in "carinin tek elle kaydı, faturasız" tanım alanı S110
  alanında gerekmez (kapsam kalem kalem belli). Görünüm TOPLAMI (`gorunumToplam`, `_cari_kalemleri`) ve takvim / projeksiyon SAYACI S110 alanındaki caride YAZILMAZ (taksit kalemlerinin
  sayaçtaki kimliği bilinmiyor — K6.5'te de yazılmıyordu; kâhinin sınırı, kural sorusu değil).
- **Y8-5 — S110 × S2 / S50 / S101 / S99 (NOT: yerine geçmez):** kart açıldıktan SONRA gelen bağsız tahsilat / stok iadesi kuyrukta S2 sırasıyla dağılır (kartın taksitleri dahil — S50; ANINDA (1));
  sonra doğan borç kalemi kuyruğa kendi vadesiyle girer, kartın kapsamına girmez (kart tüketimi yalnız açıldığı gün — C13.4 (6)); kart tahsilatı kartın taksitine (3) — hepsi AYNEN. S101: satış kartında
  satışın avanslı kısmı kartın ödenmiş kısmıdır (Y7-2 (2)) — tetik O < T olduğundan S110 ile aynı anda tetiklenmez; S101 kartından sonra doğan borç artık Y7-2 (5) ile susturulmaz (Y8-2). Taksitli
  fatura (S99) kendi kartıdır (C13.4 (6) "kendi faturasını tüketir") — S110'un kart açılışı değildir, değişmez.
- **Y8-6 — DEĞİŞMEYEN tanım alanı:** karşı yönlü kalemli kartlı cari (C16.2 / Y6-10 — net görünüm, gecikmiş tanımsız; belge durumu, bakiye, kart yazılır — kartın hangi borcu taşıdığı A ile), KS8 / KS9,
  şüpheli / değersiz, fatura iadesi, tabloya bağlı cari, Tablodan Aktar'ın mevcut borç kartı (B1.4 kendi kuralı — kartın kaydı belli), SK-14 … SK-18 → aynen. G2 (b)'nin kabul / ret kararı
  (Y7-3) S110'dan ÖNCE verilir; S110 yalnız KABUL edilen kartın neyi taşıdığını söyler.

### KULLANICIYA SORULMALI (bakım 8; kâhin bu durumda SUSAR — ders 43, SORU DÜZENİ; UÇ DURUM)
- **SK-19 (S110 — "elle kartta taksitlendirilen borç" tek okumayla belirlenemiyor):** Carinin Mevcut Borcunu Taksitlendir kartı açılırken açık borç kart tutarından fazla ve kartın tutarı tek bir elle
  kaydın açık tutarına eşit DEĞİL. Örnekler (bugün 15.04, kartın taksitleri 01.04 / 01.05 / 01.06): **(a)** 01.03 fatura 600 · 02.03 Borç X 500 · 05.03 Borç Y 700 · 15.03 kart 900; **(b)** 01.03 Borç 900 ·
  05.03 fatura 600 · 15.03 kart 600 (2 × 300); **(c)** 01.03 Borç 900 · 05.03 fatura 600 · 15.03 kart 500 (2 × 250).
  **A (öneri — elle kart elle kayıtları taşır; faturanın kendi "Bu Satışı Taksitlendir" yolu var):** kart carinin elle kayıtlarını (Borç Yaz / Açılış) vade sırasıyla içine alır, faturalar ayrı açık —
  (a) X 500 + Y'nin 400'ü kartta, açık: fatura 600 + Y 300; (b) Borç'un 600'ü kartta, açık: Borç 300 + fatura 600; (c) Borç'un 500'ü kartta, açık: Borç 400 + fatura 600 /
  **B (tutar eşleşmesi, yoksa S2):** kart tutarı bir kalemin açık tutarına eşitse o kalemi (türü ne olursa), değilse vadesi en önce gelen borçları içine alır — (a) fatura 600 + X'in 300'ü kartta, açık: X 200 + Y 700;
  (b) fatura kartta, açık: Borç 900; (c) Borç'un 500'ü kartta, açık: Borç 400 + fatura 600 (A ile aynı) / **C:** uç durum böyle kalsın (BİLİNEN SINIR). (Bakiye her seçenekte aynı; değişen hangi kalemin
  açık kaldığı — takvim / Vade Takip kalemi, fatura listesi, sonra gelen ödemenin sırası.)

### Kurallar (kod commit'i `467d289b`; yorumların `model.py`'deki karşılığı)
- **C20.1 (Y8-1 / Y8-3) `_tyk` kart tüketimi (yalnız `2.5.0`):** kartın olayında O = Σ kuyruk kalanı {M1e'nin tüketebileceği açık borç yönlü kalemler — kartın kendi taksitleri hariç}; tetik O > T
  (mutant 258: O ≥ T; 259: O > T + 1 kuruş). Elle kart (Taksitler'den `kart_ac {mevcut}` — `api`; Tablodan Aktar kartı girmez, Y8-6): açık tutarı T'ye eşit TEK kalem `hareketler`de (elle Borç /
  borçlu Açılış) ise `hedef_` = o kalem (`t["s110"] = ("kendi", kalem)`), değilse `("sus", O, T, eşitler)` — tüketim eski sırayla sürer ama cari C13.4 (11) düzeninde susar. Satış kartı: `hedef_` =
  kendi satışı AYNEN (mutant 256 / 260: tetikte vade sırası). Mutant 256: iki kol vade sırası (S110 B); 257: elle kol eski kural.
- **C20.2 (Y8-2) `_alacak_govde250`:** SK-19 nedeni "S110: Mevcut Borç kartı … tek okumayla belirlenemiyor … KULLANICIYA SORULMALI SK-19 (§20)"; Y7-2 (5)'in "öbür açık borç" kolu (`diger_acik`,
  başka Mevcut Borç kartı yokken) neden değil S110 alanı; `son["s110"]` (alan ve neden yok) ve `son["tuketilen"]` (kart → {kalem: tutar}).
- **C20.3 (Y8-4) görünüm:** S110 alanındaki caride `kontrol` hareket döngüsü K6.5'in "tek elle kayıt, faturasız" şartını aramaz: Kalan = `kalanlar()` (defter kalanı), takvim / Vade Takip / projeksiyon tutarı
  = kuyruk kalanı, takvim sayacı yazılmaz; fatura döngüsü kartın tüketmediği SATIŞ faturasını açığıyla takvim kalemi yazar (alış faturası kartlı caride aynen yazılmaz); `_cari_kalemleri` None
  (görünüm toplamı yok).
- `--kural 2.4.9` / 2.4.6 / 2.4.5 / `--legacy`: hiçbir yol değişmedi (bütün yeni dallar `k250` ya da mutant).

### C8m Nasıl bozulur? (bakım 8 — kod commit'inde, senaryolarla birlikte yazıldı)
| # | Bozulma | Senaryo |
|---|---|---|
| Z102 | Elle kart açık borç fazlayken vade sırasıyla en eski borçları içine alır (S110 B) — kararın örneğinde fatura kartın içinde, elle borç 600 açık | d34 E1, E4, E7, E8, E14a (mutant 256, 257) |
| Z103 | Satış kartı başka açık borç varken vade sırasıyla öbür borcu tüketir; öbür borcun takvim tutarı kart kapsamıyla düşer | d34 E5, E6 (mutant 256, 260) |
| Z104 | Kart = açık borç sınırında yeni kural uygulanır — eski değerler susar / değişir | d34 E3 (mutant 258) |
| Z105 | 1 kuruş fazla "fazla" sayılmaz (eski vade sırası, iki kalem → susma) | d34 E4 (mutant 259) |
| Z106 | "Taksitlendirilen borç" belirsizken kâhin bir okuma uydurur (birden çok elle borç / eşit kalem fatura / kart elle borçtan küçük) | d34 E11, E12, E13 (SK-19) |
| Z107 | Kart sonrası tahsilat / yeni borç / stok iadesi kartın kapsamına girer ya da S2 / S50 bozulur | d34 E6, E7, E8 |
| Z108 | S101 kartından sonra doğan borç yüzünden cari susar (Y7-2 (5)) ya da borç kartın içinde sayılır | d34 E9 |
| Z109 | Karşı yönlü kalemli kartlı caride kâhin net görünüm / gecikmiş uydurur | d34 E10 |
| Z110 | Aynı adlı iki carinin borcu birbirinin kartına sayılır | d34 E14a / E14b |
| Z111 | Tablodan Aktar'ın mevcut borç kartı S110'un elle koluna girer (kartın kaydı belli — B1.4) | c6c, d2 (G3: fark 0 — ilk denemede 51 BEKLENMEYEN ile yakalandı, düzeltildi) |

### Senaryolar (bakım 8; elle tablo — kâhin koşulmadan karar metninden ve §13 / §18 / §19 / §20'den; betik `docs/kanit/2026-11-11/kahineski8-arac/yeni-senaryolar8.py`, adımların yeri `g1-sirala.py`)
- **`d34-c5-s110-kendi-borcu`** (bugün 15.04.2026; 204 elle denetim = 181 değer + 19 yok + 4 belirsiz): E1 kararın örneği AYNEN (B'nin ayrıştığı düzen: F en eski) · E2 elle borç en eski (A = B) · E3 sınır
  O = T (eski kural) · E4 O = T + 0,01 · E5 satış kolu (başka açık borçlu cariye stoktan taksitli satış) · E6 satış kolu + sonra bağsız tahsilat (S2 + S50) · E7 elle kol + sonra yeni borç + tahsilat ·
  E8 elle kol + sonra stok iadesi · E9 S101 kartı + sonra borç · E10 karşı yönlü kalem (susar) · E11 / E12 / E13 SK-19 (a) / (b) / (c) (susar) · E14a / E14b aynı adlı iki cari.
- **İlk koşu:** 204 elle denetimin 203'ü kâhinle aynı; 1 kırmızı — **E3 `takvim:fatura:E3F`**: elle "yazılmaz" (elleYok) yazılmıştı, kâhin "yok" yazdı. Kök neden ELLE tablodaydı: kâhinin kendi K6.5 (1)
  kuralı (kartlı caride tek satış faturası, elle kayıt yokken fatura kalemi NET = açık − kartın açık kapsamı = 600 − 600 = 0 → "yok") — bakım 7 kâhini de aynısını yazıyor (eski kopyada koşuldu);
  S110'la ilgisi yok (E3 tetik dışı). Elle değer `"yok"` olarak düzeltildi (betikte not); başka elle değer değişmedi.
- **Eski elle tablolar:** hiçbiri değişmedi (G3: 87 eski senaryoda fark 0).

### C10m Mutantlar (bakım 8; `oz-test.py` DEĞERLE — çökmeden, elle tablo kırmızı)
256 S110 B (iki kol vade sırası) · 257 S110 yalnız satış kolunda (elle kol eski kural) · 258 sınır: O = T de tetikler · 259 sınır: yalnız 1 kuruştan fazla aşan · 260 S110 yalnız elle kolda (satış
kartı vade sırası). Bakım 6 / 7 mutantları (241–255) aynen yakalanıyor.

### Dil ekleri (/3, bakım 8)
Yeni adım YOK; yeni çıktı anahtarı YOK. Yeni `belirsiz` kaydı: "cari <ad> tanımsız (2.5.0 C13.4 (11)): S110: Mevcut Borç kartı <no> açılırken açık borç (O) kart tutarından (T) fazla — … SK-19 (§20)".
Y7-2 (5)'in "öbür açık borç (…)" nedeni artık yalnız aynı caride başka elle Mevcut Borç kartı varken yazılır ("başka Mevcut Borç kartı (…)").

### Eşleme notları (ana oturum için; `kos.mjs` bu bakımda DEĞİŞMEDİ, açılmadı)
- Yeni adım / anahtar yok; d34 bakım 7'nin adım türleriyle (`kart_ac {mevcut}`, `stok_satis_taksit`, `stok_iade`, `tahsilat`, `fatura`, `borc`). `stok_satis_taksit`'in eşlemesi bakım 7'den beri ana oturumda.
- **Ana oturuma:** `model.py` değişti — mobil yazma kâhininin `cari_model_sha256`'sı yeniden üretilmeli (o dosya okunmadı); yapım aşaması listesi bu ajanca açılmadı (S110 alanındaki yeni değerler
  listeye yeni kayıt olarak düşebilir — ayrıştırma ana oturumda).

### C12m DENENMEYEN (bakım 8; neden)
- Program koşulmadı (görev). Programın S110 alanındaki gösterimi (takvimde taksit kalemlerinin kimliği, görünüm toplamı, sayaç) bilinmiyor — kâhin o üç denetimi S110 alanında yazmaz.
- SK-19 (d) (açık tutarı T'ye eşit birden çok kalem) ve "borçlu Açılış" kaydının kartın kendi borcu olduğu durum elle senaryo yazılmadı (kural yolu E1'le aynı: `hareketler`).
- Kısmen ödenmiş elle borç (tutar > T, açık tutar = T) — kural açık tutara bakar; senaryo yazılmadı.
- Kart açıldıktan sonra karta doğrudan Taksit Tahsilatı (bağ) ile S110 elle kol; vade günü / ertesi gün (gün dönümü) S110 senaryosu — tek bugünle yazıldı (gecikmiş kuralı C13.5 / C16.4 aynen).
- Aynı caride satış kartı + elle Mevcut Borç kartı (Y7-2 (5)'in "başka Mevcut Borç kartı" kolu aynen susar) — S110'un sorusu değil.
- Tablodan Aktar'ın mevcut borç kartı S110'a girmez (Y8-6) — yeni senaryo yazılmadı; c6c / d2'nin G3'te değişmemesi kanıt.

### C0m Değişen eski beklentiler (G3; bakım 7 `60280990` ↔ bakım 8 kâhin çıktısı, `2.5.0`; eski kopyanın 87 elle senaryosu + d34 + rastgele s1 / ux18 tohum 1–10 × 120) — kararla ilgisiz eski beklenti DEĞİŞMEDİ
Eski 46.217 → yeni 46.328 denetim; değişen / kalkan / yeni toplam **143**, hepsi d34'te; **BEKLENMEYEN 0**, değeri değişen 0, yalnız etiketi değişen 0 (dökümü `docs/kanit/2026-11-11/kahineski8-g3-dokum-*.json`,
özet `kahineski8-esdeger-cari-*.log`; iki saat diliminde bayt bayt aynı). Sınıf, yeni modelin `_alacak_govde250` sonuçlarından cari cari (S110 bayrağı / SK-19 nedeni) kaydedildi:
- **Eski 87 elle senaryo ve 20 rastgele: fark 0** (adımları değişen eski senaryo 0). Eski elle Mevcut Borç kartlı carilerin (c11, d4 KM / KP, d7 KE, d8 KA, d19 KN4, d30 QR3) hiçbir değeri değişmedi.
  **İlk G3 denemesinde 51 BEKLENMEYEN** (c6c-mevcut-borc-karti 39, d2-c5-kg5-excel-kart 12 — kalkan): kod Tablodan Aktar'ın mevcut borç kartını da elle kola alıyordu (açılış 5.000 > kart 3.000, eşit kalem
  yok → SK-19 susması). Y8-6'nın yazılı kuralına aykırı (kod hatası — kural değil); `api` (Taksitler'den açılan kart) koşulu eklendi, ikinci denemede fark 0.
- **d34 (yeni dosya, eski ↔ yeni kâhin):** S110-alan / yeni 127 — E1 16, E2 7 (Kalan / takvim — bakım 7 K6.5 "faturasız" şartıyla yazmıyordu), E4 16, E5 13, E7 22, E8 16, E9 13, E10 8, E14a 16 (bakım 7: E1 / E4 /
  E7 / E8 / E10 / E14a "birden çok kalemi tüketti", E5 / E9 Y7-2 (5) ile susuyordu) · S110-sus / kalkan 16 — E12 8, E13 8 (bakım 7 vade sırasıyla TEK kalem tükettiği için değer yazıyordu; S110'da
  kart tutarı tek elle kaydın açık tutarına eşit değil → SK-19). E3, E6, E11, E14b fark 0.
- `--kural 2.4.9` / 2.4.6 / 2.4.5 / `--legacy`: **432/432 bayt bayt aynı** (87 eski elle + d34 + 20 rastgele × 4 kip); üretici 20/20 aynı dizi.
- **Yeni elle tablo ESKİ (bakım 7) kâhinde — beklenen NEDENLE kırmızı (ders 7, 38):** 204 elle denetimin **112**'si (`kahineski8-kirmizi-eski-cari-*.log`): E1 / E4 / E7 / E8 / E10 / E14a'da eski kâhin
  "birden çok kalemi tüketti" ile susuyor (vade sırası — S110 B'nin tüketimi), E5 / E9'da Y7-2 (5) ile susuyor, E2'de Kalan / takvim yazmıyor, E12 / E13'te vade sırasıyla değer YAZIYOR (elle YOK) ve
  SK-19 kayıtları yok; 92'si iki kâhinde aynı (bakiyeler, E3 sınırı, E6, E11'in susması, kart tutarları).

### Kanıt (bakım 8; iki saat dilimi — UTC ve Europe/Istanbul çıktıları bayt bayt aynı (başlık satırları dışında); kâhin `467d289b`, temiz ağaç; `docs/kanit/2026-11-11/kahineski8-*`, araçlar ve koşu betiği `kahineski8-arac/`)
cari öz test **4.050/4.050** (`-cari-oz-*`: elle tablolar 88 senaryo, mutantlar 200–260 — 219–260 değerle, saf TYK 174 kalem, bakım 4–6 çapraz denetimi, G1 88 senaryo × 103 belge adımı) · mutasyon taraması
**227/227** (`-cari-mutasyon-*`; kos.mjs düzeni, bütün elle dosyalar × kipler) · eşdeğerlik + G3 **540/540** (`-esdeger-cari-*`) · yeni elle tablo **204/204** (`-elle-yeni-cari-*`) · ESKİ kâhinde **112 kırmızı** / 204
(`-kirmizi-eski-cari-*`) · G1 tarama **88/88** (`-g1-tara-*`) · geniş tarama **2.201/2.201** (`-genis-tarama-*`; bakım 7 ile aynı sayı). **Defter öz testi BAŞARISIZ** (`-defter-oz-*`; `VARSAYILAN_KURAL`
AttributeError) — bakım 7'deki gibi TABANDA da aynı (eski kopyada koşuldu); bu bakım defter kâhinine dokunmadı. Mutasyon, eşdeğerlik, öz test ve geniş tarama `flock -s -n …/olcum.lock` ile koşuldu
(ders 52). Program açılmadı.

## 21. 2.5.0 Ç5 bakımı 9 — S120 (elle açılan kart tek bir elle borca denk gelmiyorsa: yalnız ELLE borçlar, eskiden yeniye) (11.11.2026, `date -u` 07:08; karar 11.11.2026 — ana oturumun özet dosyası; eski kâhinler bakımı 9 — kodu görmeyen AYRI el) — kural seti `2.5.0` = §13 + … + §20 + bu bölüm

Bu bakım KÜÇÜKTÜR: tek kullanıcı kararı (S120 — bakım 8'in SK-19 sorusunun yanıtı), yalnız §20 Y8-3'ün SUSTUĞU alanı (elle açılan kart, açık borç kart tutarından fazla, kart tutarı tek bir
elle kaydın açık tutarına eşit değil) değer alanına çevirir. S110 (Y8-1 tetik, Y8-2 satış kolu, Y8-3'ün tek okuma alanı), S2, S50, S101, S99 ve §13–§20'nin öbür kuralları DEĞİŞMEZ. `--kural 2.4.9`
(ve 2.4.6 / 2.4.5 / `--legacy`) AYNEN. Defter kâhini (`test/bagimsiz/defter/`) DEĞİŞMEZ (Mevcut Borç kartı maddesizdir — C13.2 / kitap H-02; kartın hangi borcu taşıdığı yevmiyeyi değiştirmez).
**Bu bölümün ilk commit'i yalnız YORUMDUR (ders 40 — önce kural, sonra kod); senaryo / mutant / G3 sayıları kod ve kanıt commit'lerinde eklenir.**

### C00n Temiz oda (bakım 9)
- **Girdi (AYNEN; ana oturumun özet dosyası `scratchpad/kahin-eski9-kararlar.md` — "programın hesap / görünüm davranışı hakkında hiçbir bilgi içermez"):**
  - SORU (kullanıcıya gösterilen metin — AYNEN): "S110'da 'kart kendi borcunu taşır' demiştiniz. Taksitler'den açılan kartın tutarı tek bir elle borca eşitse sorun yok. Eşit değilse karar iki
    türlü okunabiliyor. Örnek: carinin üç borcu var: fatura 600 (en eski), elle borç X 500, elle borç Y 700. Taksitler'den 900'lük kart açılıyor. — A (öneri) — kart yalnız elle borçları, eskiden
    yeniye alır; faturalar ayrı kalır: kartın içine giren (taksit vadesiyle izlenir) X 500 + Y'nin 400'ü; ayrı kalan (kendi vadesiyle izlenir) fatura 600 + Y 300. — B — tutarı karta eşit bir kalem
    varsa onu alır; yoksa bütün borçları eskiden yeniye alır: kartta fatura 600 + X'in 300'ü; ayrı X 200 + Y 700. — C — uç durum böyle kalsın (bilinen sınır). Toplam borç ve bakiye üç seçenekte
    de aynı. Değişen yalnız hangi borcun taksit vadesiyle, hangisinin kendi vadesiyle 'gecikmiş' sayıldığı."
  - KARAR (iş listesi D, 11.11 — AYNEN): "S120 = A (PARA KURALI) — ELLE açılan taksit kartı (Taksitler'den) açıldığı anda carinin açık borcu kart tutarından fazlaysa ve kart tutarı TEK bir
    elle borca denk gelmiyorsa kart yalnız ELLE borçları, eskiden yeniye içine alır; faturalar kendi vadesiyle ayrı kalır. Örnek: fatura F 600 (en eski) + elle borç X 500 + elle borç Y 700, kart
    900 ⇒ kartta X 500 + Y'nin 400'ü; ayrı açık F 600 + Y 300. (Kullanıcıya gösterilen öbür örnekler: elle borç 900 + F 600, kart 600 ⇒ elle borcun 600'ü kartta, açık elle 300 + F 600; elle
    borç 900 + F 600, kart 500 ⇒ elle borcun 500'ü kartta, açık elle 400 + F 600.) Tutarı karta eşit TEK elle borç varsa S110 = A aynen (kart onu taşır)."
  - NOT (ana oturum): "(1) bu karar bakım 8'in SK-19 susmasının (a), (b), (c) durumlarını ve — metinden tek okumayla çıkıyorsa — (d)'yi yanıtlar; S110, S2, S50, S101 kararlarının YERİNE geçmez.
    (2) Karar metni şu alt durumu SÖYLEMİYOR: elle borçların toplamı kart tutarından AZSA (açık borcun fazlalığı yalnız faturalardan geliyorsa) kartın kalan kısmı ne taşır — kâhin o alt durumda
    SUSAR ve 'KULLANICIYA SORULMALI' yazar (iki seçenek + öneri; uç durumsa üçüncü seçenek 'Uç durum böyle kalsın (BİLİNEN SINIR)'). Karar metninden tek okumayla çıkmayan başka alt durum
    görürsen aynı yolu izle; kendi yorumunla kesinleştirme."
- **Birlikte okunan (kâhinin kendi belgesi):** bu dosyanın §13 C13.4 (1)–(11) ve C13.5, K6.5, §20 (bütünü — C00m, Y8-1 … Y8-6, SK-19, C20.1 … C20.3, C8m, C0m); `model.py` kart tüketimi (`_tyk`,
  `_alacak_govde250`, `kart_ac`, `_g2b_okumalar`) ve görünüm (`kontrol` hareket / fatura kalemleri); d34 elle senaryosu ve onu üreten `docs/kanit/2026-11-11/kahineski8-arac/yeni-senaryolar8.py`.
  Okunan / okunmayan dosyaların tam listesi (satır aralıklarıyla) ajan raporunda.
- **Okunmayan:** `server/**`, `client/**`, `bulut/**`, `packaging/**`, `tools/**` (yalnız `kanit.mjs` çalıştırılır), `docs/erp/C5-ACILIS-TASARIM.md`, `docs/erp/C5B-TYK-TASARIM.md`, `docs/devir/**`,
  `docs/2.5.0-IS-LISTESI*.md` (hiçbir sürümü), `test/bagimsiz/cari/YAPIM-ASAMASI.json`, `kos.mjs`, iki kâhin klasörü dışındaki `test/**`, başka ajanların `docs/kanit/**` dosyaları (yalnız
  `kahineski8-arac/` araçları), git farkı / geçmiş içeriği. Program koşulmadı; programın davranışı aranmadı. CLAUDE.md "Açık iş"teki program durumu kural / beklenti kaynağı sayılmadı.

### Kâhinin BUGÜNKÜ (bakım 8, `467d289b`) okuması — S120 alanında (açıkça)
Bakım 8 kâhini S120'nin hiçbir seçeneğini DEĞER olarak yazmıyordu: elle kartta (Taksitler'den, O > T) açık tutarı T'ye eşit TEK kalem yoksa ya da o kalem elle kayıt değilse (SK-19 (a) / (b) /
(c) / (d)) kart tüketimi eski M1e sırasıyla (bütün borç kalemleri, vade sırası — S120'nin B'sinin "yoksa" kolu) sürüyor, ama cari C13.4 (11) düzeninde SUSUYORDU (Kalan / açık / kart kalanı /
gecikmiş / görünüm yazılmaz; `belirsiz` "… S110 … SK-19 (§20)"). Yazılanlar yalnız bakiye ve kart tutarı. (d)'nin "biri fatura, biri elle iki eşit kalem" düzeni de susuyordu. Kararın üç örneği
d34 E11 / E12 / E13'tür (SK-19 (a) / (b) / (c) — aynı tarih ve tutarlarla).

### Yorumlar (ders 40 — karardan; kod yazılmadan ÖNCE; baş mimar kullanıcıya gösterir)
- **Y9-1 — alan:** S120 yalnız §20 Y8-1'in tetiğinde (kartın açıldığı anda O > T, 1 kuruş fazlası da fazla) ve yalnız ELLE kolda (Taksitler'den açılan "Carinin Mevcut Borcunu Taksitlendir" kartı;
  karar "ELLE açılan taksit kartı (Taksitler'den)") uygulanır. Satışla açılan kart (Y8-2), Tablodan Aktar'ın mevcut borç kartı (Y8-6 — B1.4), taksitli fatura (S99), O = T ve O < T (G2 (b) / S101 /
  EK-2B 32) AYNEN.
- **Y9-2 — istisna "Tutarı karta eşit TEK elle borç":** kartın açıldığı anda açık tutarı T'ye eşit ELLE kalem (elle Borç Yaz ya da borçlu Açılış — Y8-3 (ii)) TAM BİR tane varsa Y8-3 AYNEN (kart
  yalnız onu tüketir) — öbür kalemlerden biri (fatura, stok satışı, karşılıksız, başka kartın taksiti) de T'ye eşit olsa bile ("TEK elle borç" — eşit fatura istisnayı bozmaz; bakım 8'de bu düzen
  SK-19 (d) ile susuyordu).
- **Y9-3 — ana kural "yalnız ELLE borçlar, eskiden yeniye":** öbür her durumda (T'ye eşit elle kalem yok — eşit kalem fatura olsa da (kararın ikinci örneği) — ya da birden çok; Y9-5) kart, kartın
  günündeki AÇIK elle kalemleri (elle Borç Yaz, borçlu Açılış; kuyruk kalanı > 0 — kısmen ödenmiş elle borç açık kısmıyla) eskiden yeniye T dolana dek içine alır; son alınan kalem kısmen
  kartta, kısmen açık kalabilir (örnek: Y'nin 400'ü kartta, 300'ü açık). Taksitsiz satış faturası, stok veresiye satışı, karşılıksız borç kalemi, öbür kartların ve taksitli faturaların taksitleri
  kartın içine GİRMEZ ("yalnız ELLE borçları"; "faturalar kendi vadesiyle ayrı kalır") — kendi kalanıyla, kendi vadesiyle kuyrukta kalır. Kararın üç örneği AYNEN: (1) F 600 + X 500 + Y 700, kart
  900 ⇒ X 500 + Y 400 kartta, açık F 600 + Y 300; (2) elle 900 + F 600, kart 600 ⇒ elle 600 kartta, açık elle 300 + F 600; (3) elle 900 + F 600, kart 500 ⇒ elle 500 kartta, açık elle 400 + F 600.
- **Y9-4 — "eskiden yeniye"nin sırası:** karar sıra sözcüğü olarak yalnız "eskiden yeniye" diyor. Vadesiz elle kalemde vade = belge günü (S1 A) → belge tarihi ile vade sırası (S2: vade → belge →
  yazım) AYNI sırayı verir; vadeli elle kalemlerde iki sıra aynı TÜKETİMİ veriyorsa tek okuma. İki sıranın TÜKETİMİ ayrışıyorsa ("eski" belge tarihi mi, vade mi) kâhin SUSAR — **SK-23**.
- **Y9-5 — T'ye eşit birden çok elle borç (SK-19 (d)):** metnin harfi istisnayı "TEK elle borç"a bağlar → ana kural (Y9-3); öbür okuma "kart, karta eşit elle borçlardan birini taşır" (S110'un
  "kendi borcu" işareti — Y8-3 (i) tutar). Ana kuralın sonucu zaten T'ye eşit BİR elle kalemin tamamıysa (eskiden yeniye ilk açık elle kalem eşit kalemlerden biri) iki okuma aynı → değer;
  değilse (eskiden yeniye önce eşit olmayan bir elle kalem geliyor) SUS — **SK-22**.
- **Y9-6 — NOT (2): açık elle borçların toplamı E < T** (O > T; fazlalık elle olmayan kalemlerden): kartın E'yi aşan kısmının neyi taşıdığı karar metninde yok → SUS — **SK-20**. E = T: kart bütün
  açık elle kalemleri tamamen içine alır (tek okuma — Y9-3'ün sınırı).
- **Y9-7 — defter kalanı birden çok tüketilen elle kalemde (C13.4 (7)):** kartın ödenen kısmı 0 iken her tüketilen elle kalemin Kalan'ı = kuyruk kalanı + tüketilen (K6.5 (a) AYNEN; ödemenin
  dağılımı sorusu doğmuyor — kararın örneğinde X Kalan 500, Y Kalan 700). Kartın ödenen kısmı > 0 iken (kart tahsilatı ya da S50 ile bağsız tahsilatın taksite düşen payı) ödemenin tüketilen elle
  kalemlere dağılımı karar metninde yok → C13.4 (7) / (11) AYNEN susar; S120 bu düzeni olağan kıldığından (örneğin her taksit ödemesi) **SK-21** olarak KULLANICIYA SORULMALI. Tek kalem tüketen
  kart (Y9-2, kararın 2. / 3. örneği) C13.4 (7) ile tanımlı (değişmedi). Görünüm Y8-4 AYNEN: takvim / Vade Takip / projeksiyon tutarı = kuyruk kalanı (kartın tamamen içine aldığı kalem 0; kısmen
  aldığı kalem açık kısmıyla); kartın içine almadığı satış faturası kendi açığıyla takvim kalemi; sayaç ve görünüm toplamı S110 alanında yazılmaz (kâhinin sınırı — Y8-4).
- **Y9-8 — S2 / S50 / S101 / S99 (NOT (1): yerine geçmez; Y8-5 AYNEN):** kart açıldıktan SONRA gelen bağsız tahsilat / stok iadesi kuyrukta S2 sırasıyla dağılır (kartın dışında kalan F 600 ve
  Y'nin açık 300'ü kendi vadeleriyle, kartın taksitleri taksit vadeleriyle — S50; ANINDA (1)); sonra doğan borç kuyruğa kendi vadesiyle girer, kartın içine girmez (tüketim yalnız kartın günü —
  C13.4 (6)); kart tahsilatı kartın taksitine (3). Gecikmiş C13.5 AYNEN (kuyruk kalanı, v < bugün). S101'in tetiği O < T — S120 ile aynı anda tetiklenmez.
- **Y9-9 — DEĞİŞMEYEN:** Y8-6'nın tanım alanı (karşı yönlü kalemli kartlı cari, KS8 / KS9, şüpheli / değersiz, fatura iadesi, tabloya bağlı cari, Tablodan Aktar kartı, SK-14 … SK-18), G2 (b)'nin
  kabul / ret kararı (Y7-3 — S120'den ÖNCE verilir), Y7-2 (5)'in "başka Mevcut Borç kartı" kolu (aynı caride satış kartı + elle kart — aynen susar).

### SK-19'un durumları bu kararla (açıkça)
| SK-19 | Bakım 8 | Bakım 9 (S120 A) |
|---|---|---|
| (a) birden çok elle borç, T'ye eşit kalem yok (kararın 1. örneği) | SUS | **DEĞER** (Y9-3) — SK-23 (vade ↔ belge sırası tüketimi ayırıyor), SK-21 (kart ödemeli), SK-20 (E < T) dışında |
| (b) T'ye eşit kalem elle kayıt değil (kararın 2. örneği) | SUS | **DEĞER** (Y9-3; eşit fatura sayılmaz) — aynı istisnalar |
| (c) tek elle borç T'den büyük, eşit kalem yok (kararın 3. örneği) | SUS | **DEĞER** (Y9-3; tek kalem → kart ödemeli de tanımlı, C13.4 (7)) |
| (d) T'ye eşit birden çok kalem | SUS | bir eşit elle + eşit fatura → **DEĞER** (Y9-2); birden çok eşit elle → ilk açık elle kalem eşitse **DEĞER**, değilse **SUS (SK-22)** (Y9-5) |

### KULLANICIYA SORULMALI (bakım 9; kâhin bu durumlarda SUSAR — ders 43, SORU DÜZENİ)
Örneklerde bugün 15.04, kartın taksitleri 01.04 / 01.05 / 01.06 (2 taksitlide 01.04 / 01.05). Bakiye her seçenekte aynı; değişen hangi kalemin açık kaldığı (takvim / Vade Takip kalemi, fatura
listesi, sonra gelen ödemenin sırası) ya da (SK-21) elle kaydın "Kalan" sütunu.
- **SK-20 (NOT (2) — açık elle borçların toplamı kart tutarından az; UÇ DURUM):** 01.03 fatura F 600 · 02.03 Borç X 300 · 15.03 kart 500 (2 × 250). Elle borç toplamı 300 < 500.
  **A (öneri — "eskiden yeniye"nin devamı):** kart önce bütün elle borçları, kalan 200'ü faturalardan eskiden yeniye alır: kartta X 300 + F'nin 200'ü; açık F 400. / **B:** kart elle borçların
  toplamından büyük olamaz — kart REDDEDİLİR (G2 (b)'deki gibi; "taksitlendirilebilecek borç" = elle borçlar). / **C:** uç durum böyle kalsın (BİLİNEN SINIR).
- **SK-21 (kartın içinde birden çok elle borç varken karta ödeme gelince hangi elle kaydın "Kalan"ı düşer; uç durum DEĞİL — kararın 1. örneğinde her taksit ödemesinde):** kararın 1. örneği + 10.04 kart
  tahsilatı 300 (1. taksit). Kartın içi X 500 + Y'nin 400'ü. **A (öneri — kartın içine alma sırasıyla, eskiden yeniye):** X Kalan 200, Y Kalan 700 (300 açık + 400 kartta) / **B (en yeniden):** X Kalan
  500, Y Kalan 400. (Bakiye 1.500, kart kalanı 600, gecikmiş, takvim her iki seçenekte aynı.)
- **SK-22 (karta eşit birden çok elle borç, eskiden yeniye önce başka elle borç geliyor; UÇ DURUM):** 01.03 F 600 · 02.03 Borç Z 300 · 03.03 Borç X 900 · 05.03 Borç Y 900 · 15.03 kart 900.
  **A (kararın harfi — "TEK" istisnası tek eşit elle borçta):** eskiden yeniye: kartta Z 300 + X'in 600'ü; açık F 600 + X 300 + Y 900. / **B (öneri — S110'un "kendi borcu": tutarı karta eşit
  elle borçlardan en eskisi):** kartta X 900; açık F 600 + Z 300 + Y 900. / **C:** uç durum böyle kalsın (BİLİNEN SINIR).
- **SK-23 ("eskiden yeniye" belge tarihi mi vade mi — iki sıra tüketimi ayırıyor; UÇ DURUM):** 01.03 F 600 · 02.03 Borç X 500 (vade 30.03) · 05.03 Borç Y 700 (vade 10.03) · 15.03 kart 900.
  **A (öneri — vade sırası, S2 ile aynı):** kartta Y 700 + X'in 200'ü; açık F 600 + X 300 (vade 30.03). / **B (belge tarihi):** kartta X 500 + Y'nin 400'ü; açık F 600 + Y 300 (vade 10.03). / **C:** uç
  durum böyle kalsın (BİLİNEN SINIR).

### Kurallar (kod commit'i; yorumların `model.py`'deki karşılığı)
- **C21.1 (Y9-1 … Y9-6) `_tyk` elle kol (yalnız `2.5.0`; Y8-1 tetiği ve `api` koşulu AYNEN):** `elle_` = kartın günündeki açık kalemlerden `hareketler`dekiler (elle Borç / borçlu Açılış); `es` = açık tutarı T'ye eşit
  elle kalemler. `len(es) == 1` → `("kendi", kalem, eşit fatura da var mı)` (Y9-2; bakım 8 aynen). Değilse: E = Σ elle açık; E < T → `("sus", …, "SK-20")`; vade sırası (S2 anahtarı) ile belge sırası (d → s)
  farklı tüketim veriyorsa → `"SK-23"`; `len(es) ≥ 2` ve eskiden yeniye tüketim tek bir eşit elle kalemin tamamı değilse → `"SK-22"`; öbür durumda kart elle kalemleri S2 sırasıyla (vadesizde = belge
  sırası) içine alır (`liste_`, `("elle", kalemler)`). Yardımcı `_s120_doldur` (yan etkisiz). Susan kartın tüketimi eski sırayla sürer, cari C13.4 (11) düzeninde susar (bakım 8 düzeni).
- **C21.2 (Y9-7) `_alacak_govde250`:** `s120_kart` (S120 alanındaki kartlar — `son["s120"]`, iz); birden çok kalem tüketen S120 kartında ödenen kısım 0 → her kalemin defter kalanı = kuyruk kalanı +
  tüketilen; > 0 → neden "… SK-21 (§21)" (C13.4 (7) / (11)). SK-19 nedeni kalktı; yeni neden "S120: Mevcut Borç kartı <no> … KULLANICIYA SORULMALI SK-20 | SK-22 | SK-23 (§21)".
- **C21.3 görünüm:** değişmedi — S110 alanının (`son["s110"]`) kuralları (Y8-4 / C20.3) çok kalemli S120 kartında da işler (Kalan defter kalanı, takvim / Vade Takip / projeksiyon kuyruk kalanı,
  kartın içine almadığı satış faturası kendi açığıyla; sayaç ve görünüm toplamı yazılmaz).
- `--kural 2.4.9` / 2.4.6 / 2.4.5 / `--legacy`: hiçbir yol değişmedi (yeni dallar `k250` içinde ya da mutant).

### C8n Nasıl bozulur? (bakım 9 — kod commit'inde, senaryolarla birlikte yazıldı)
| # | Bozulma | Senaryo |
|---|---|---|
| Z112 | Elle kart (eşit elle borç yok) faturayı da içine alır (S120 B / vade sırası bütün borçlar) | d34 E11, d35 H1 (mutant 261, 262) |
| Z113 | Elle borçlar yeniden eskiye alınır | d34 E11, d35 H14 (mutant 263) |
| Z114 | "Tutarı karta eşit TEK elle borç" istisnası ezilir (eskiden yeniye alınır) | d35 H4a (mutant 264) |
| Z115 | Eşit fatura, tek eşit elle borcun istisnasını bozar (SK-19 (d) gibi susar ya da faturayı alır) | d35 H4b (mutant 261) |
| Z116 | Kart sonrası tahsilat / yeni borç / stok iadesi kartın içine girer ya da S2 / S50 bozulur | d35 H1, H12, H13, H14 |
| Z117 | Kısmen ödenmiş elle borç tam tutarıyla alınır | d35 H6a, H6b |
| Z118 | Borçlu Açılış elle borç sayılmaz | d35 H5, d8 A |
| Z119 | Kâhin kararın söylemediği alt durumda okuma uydurur (elle toplamı < kart; vade ↔ belge sırası; birden çok eşit elle borç; çok kalemli kartın ödemesi) | d35 H8 (SK-20), H9a (SK-23), H3 (SK-22), H10 / H11 (SK-21) |
| Z120 | Birden çok eşit elle borçta ilk elle kalem eşitken de susar | d35 H2 |
| Z121 | Aynı adlı iki carinin borcu birbirinin kartına girer | d35 H15a / H15b |

### Senaryolar (bakım 9; elle tablolar — kâhin koşulmadan karar metninden ve §13 / §20 / §21'den; betikler `docs/kanit/2026-11-11/kahineski9-arac/yeni-senaryolar9.py`, `d34-guncelle9.py`, `d8-guncelle9.py`, adımların yeri `g1-sirala.py`)
- **`d35-c5-s120-elle-borclar`** (bugün 15.04.2026; 342 elle denetim = 307 değer + 30 yok + 5 belirsiz): H1 kararın 1. örneği + sonra bağsız tahsilat 600 · H2 iki eşit elle borç (ilk elle eşit) · H3 SK-22 ·
  H4a tek eşit elle borç (bakım 8 aynen) · H4b tek eşit elle borç + eşit fatura · H5 borçlu Açılış · H6a kısmen ödenmiş elle borç · H6b kısmen ödenmiş, açığı karta eşit · H7 elle toplamı = kart ·
  H8 SK-20 · H9a SK-23 · H9b vadeli, sıra aynı · H10 SK-21 (S50 payı) · H11 SK-21 (kart tahsilatı) · H12 sonra yeni borç · H13 sonra stok iadesi · H14 sonra kısmi tahsilat (karta ulaşmaz) · H15a / H15b aynı adlı iki cari.
- **`d34-c5-s110-kendi-borcu` E11 / E12 / E13 (kararın üç örneği AYNEN — bakım 8'in SK-19 (a) / (b) / (c)):** 14 `elleYok` + 3 `elleBelirsiz` (SK-19) KALKTI, 49 elle değer EKLENDİ (E11: X Kalan 500, Y Kalan 700,
  gecikmiş 1.200, açık toplamı 1.800, F açık 600 + takvim 600, Y takvim 300 (−41), X takvim yok, kart 900 / 0; E12: Borç Kalan 900, gecikmiş 1.200, açık 1.500, F 600, Borç takvim 300 (−45), kart 600 / 0;
  E13: Borç Kalan 900, gecikmiş 1.250, açık 1.500, F 600, Borç takvim 400 (−45), kart 500 / 0). Adımlar ve öbür beklentiler (E1–E10, E14) AYNEN. d34 toplam 236 elle denetim (bakım 8: 204).
- **`d8-c5-tanimsiz` A (S120 alanına girdi — karar gereği):** elle kart 1.200, açık borç Açılış 1.000 + Borç 500 (fatura yok, eşit kalem yok) → kart Açılış 1.000 + Borç'un 200'ü; 4 `elleYok` KALKTI,
  4 elle değer EKLENDİ (Açılış Kalan 1.000, Borç Kalan 500, kart ödenen 0, gecikmiş 900 — bugün 15.06). Bakım 8'e kadar "birden çok kalemi tüketti" / SK-19 ile susuyordu. B carisi aynen susar.
- **İlk koşu:** d35'in 342 elle denetiminin hepsi kâhinle aynı (koşudan sonra değişen elle değer YOK). d34 E11–E13 değerleri elle hesaplandıktan sonra, dosyaya yazılmadan önce kâhinin d34 çıktısına
  bir kez bakıldı (sağlama — değerler aynıydı; bağımsızlık notu). d8 A'nın kırmızısı öz testte görüldü (eski elle tablo: "yok" beklenirken kâhin değer yazdı — beklenen neden: karar alanı genişledi);
  değerler karar metninden elle hesaplandı, kırmızı satırındaki kâhin değerleriyle aynı (bağımsızlık notu: kırmızı satırı değerlerden önce görüldü).

### C10n Mutantlar (bakım 9; `oz-test.py` DEĞERLE — çökmeden, elle tablo kırmızı)
261 S120 B (eşit kalem türü ne olursa, yoksa bütün borçlar vade sırası) · 262 faturayı da içine alan elle kol · 263 elle borçlar yeniden eskiye · 264 "eşit TEK elle borç" istisnası ezilir. Bakım 6 / 7 / 8
mutantları (241–260) aynen yakalanıyor.

### Dil ekleri (/3, bakım 9)
Yeni adım YOK; yeni çıktı anahtarı YOK. `belirsiz` kayıtları: "cari <ad> tanımsız (2.5.0 C13.4 (11)): S120: Mevcut Borç kartı <no> açılırken açık borç (O) kart tutarından (T) fazla — … KULLANICIYA SORULMALI
SK-20 | SK-22 | SK-23 (§21)" ve "… Mevcut Borç kartı <no> birden çok elle borcu içine aldı (S120 A) ve kartın <x>'i ödendi — … SK-21 (§21)". SK-19 kaydı artık yazılmaz.

### Eşleme notları (ana oturum için; `kos.mjs` bu bakımda DEĞİŞMEDİ, açılmadı)
- Yeni adım / anahtar yok; d35 bakım 7–8'in adım türleriyle (`cari_ac {acilis}`, `fatura`, `borc {vade}`, `tahsilat`, `kart_ac {mevcut}`, `kart_tahsilat`, `stok_iade`).
- **Ana oturuma:** `model.py` değişti — mobil yazma kâhininin `cari_model_sha256`'sı yeniden üretilmeli (o dosya okunmadı); yapım aşaması listesi bu ajanca açılmadı (S120 alanındaki yeni değerler —
  d34 E11–E13, d8 A, d35 — listeye yeni kayıt olarak düşebilir; ayrıştırma ana oturumda).

### C12n DENENMEYEN (bakım 9; neden)
- Program koşulmadı (görev). Programın S120 alanındaki gösterimi (takvimde taksit kalemlerinin kimliği, görünüm toplamı, sayaç) bilinmiyor — kâhin o denetimleri S120 alanında yazmaz (Y8-4 aynen).
- Kart açıldıktan sonra kartın taksit tahsilatı ile birden çok elle borç: yalnız SUS (SK-21) denetlendi — kararlı değer yok (kullanıcı kararı bekler).
- Vade günü / ertesi gün (gün dönümü) S120 senaryosu — tek bugünle yazıldı (gecikmiş kuralı C13.5 aynen); S120 kartının iki şirket / yedek geri yükleme senaryosu yok (kâhinin dilinde şirket yok).
- Aynı caride iki elle S120 kartı (ikinci kart birincinin dışında kalan elle borcu alır) — kural yolu aynı (kartın günündeki açık elle kalemler); elle senaryo yazılmadı.
- Ödeme Sözü (Beklenen) taşıyan elle borcun S120 sırası — S52 "sırayı değiştirmez" aynen; senaryo yazılmadı.

### C0n Değişen eski beklentiler (G3; bakım 8 (`9446aff4` ağacı, kâhin `467d289b`) ↔ bakım 9 kâhin çıktısı, `2.5.0`; eski kopyanın 88 elle senaryosu + d35 + rastgele s1 / ux18 tohum 1–10 × 120) — kararla ilgisiz eski beklenti DEĞİŞMEDİ
Eski 46.588 → yeni 46.899 denetim; değişen / kalkan / yeni toplam **311**, hepsi **S120-alan / yeni** (bakım 8'in sustuğu yerde artık değer); **BEKLENMEYEN 0**, değeri değişen 0, kalkan 0, yalnız etiketi değişen 0
(dökümü `docs/kanit/2026-11-11/kahineski9-g3-dokum-*.json`, özet `kahineski9-esdeger-cari-*.log`; iki saat diliminde bayt bayt aynı). Sınıf, yeni modelin `_alacak_govde250` sonuçlarından cari cari
(`son["s120"]` / S120 ve SK-21 nedenleri) kaydedildi:
- **d34 (52 yeni):** E11 22, E12 15, E13 15 — kararın üç örneği; bakım 8 SK-19 ile susuyordu. E1–E10, E14a / E14b fark 0.
- **d8 (17 yeni):** A carisi (Açılış 1.000 + Borç 500, kart 1.200 — elle borçlar eskiden yeniye; bakım 8'de SK-19, önceden "birden çok kalemi tüketti"). B fark 0.
- **d35 (242 yeni; dosya yeni, eski kâhinde de koşuldu):** H1 22, H2 22, H4b 16, H5 22, H6a 22, H7 22, H9b 22, H12 28, H13 22, H14 22, H15a 22 (eski kâhin SK-19 ile susuyordu). Fark 0: H3 (SK-22), H8 (SK-20),
  H9a (SK-23), H10 / H11 (SK-21) — iki kâhinde de susar; H4a ve H6b (tek eşit elle borç — bakım 8 kuralı AYNEN), H15b.
- **Öbür 86 eski elle senaryo ve 20 rastgele: fark 0** (adımları değişen eski senaryo 0).
- **Eski ELLE tablolarda değişen beklentiler** (`kahineski9-elle-fark-*.log`; yalnız iki dosya, karar gereği): d34 E11–E13 — 14 `elleYok` + 3 `elleBelirsiz` (SK-19) kalktı, 49 değer eklendi; d8 A — 4 `elleYok`
  (Borç / Açılış Kalan, kart ödeneni, gecikmiş) kalktı, 4 değer eklendi. Öbür 86 dosyanın elle tablosu ve bütün dosyaların adımları AYNI.
- `--kural 2.4.9` / 2.4.6 / 2.4.5 / `--legacy`: **436/436 bayt bayt aynı** (88 eski elle + d35 + 20 rastgele × 4 kip); üretici 20/20 aynı dizi.
- **Yeni / değişen elle tablolar ESKİ (bakım 8) kâhinde — beklenen NEDENLE kırmızı (ders 7, 38):** 587 elle denetimin **253**'ü (`kahineski9-kirmizi-eski-cari-*.log`; d35 205, d34 44, d8 4): 248'i "ANAHTAR YOK"
  (eski kâhin SK-19 / "birden çok kalemi tüketti" ile susuyor), 5'i `belirsiz` kaydında SK-20 / SK-21 / SK-22 / SK-23 yok (eski kâhin SK-19 yazıyor); 334'ü iki kâhinde aynı (bakiyeler, kart tutarları,
  H4a / H6b — bakım 8 kuralı, H15b).

### Kanıt (bakım 9; iki saat dilimi — UTC ve Europe/Istanbul çıktıları bayt bayt aynı; kâhin `ab628e61`, temiz ağaç; `docs/kanit/2026-11-11/kahineski9-*`, araçlar ve koşu betiği `kahineski9-arac/`)
cari öz test **4.457/4.457** (`-cari-oz-*`: elle tablolar 89 senaryo, mutantlar 200–264 — 219–264 değerle, saf TYK 175 kalem, bakım 4–6 çapraz denetimi, G1 89 senaryo × 121 belge adımı) · mutasyon taraması
**231/231** (`-cari-mutasyon-*`) · eşdeğerlik + G3 **545/545** (`-esdeger-cari-*`) · yeni / değişen elle tablo **587/587** (`-elle-yeni-cari-*`: d35 342 + d34 236 + d8 9) · ESKİ kâhinde **253 kırmızı** / 587
(`-kirmizi-eski-cari-*`) · eski elle tablo farkı **88/88** izinli (`-elle-fark-*`) · G1 tarama **89/89** (`-g1-tara-*`) · geniş tarama **2.201/2.201** (`-genis-tarama-*`; bakım 8 ile aynı sayı) · mutant ↔ senaryo
dökümü `kahineski9-arac/mutant-senaryo.py` (261 H1 / H4b / E11 / E12, 262 H1 / E11, 263 H14 / E11, 264 H4a). **Defter öz testi BAŞARISIZ** (`-defter-oz-*`; `VARSAYILAN_KURAL` AttributeError) — TABANDA da aynı
(eski kopya `9446aff4`'te koşuldu); bu bakım defter kâhinine dokunmadı. Mutasyon, eşdeğerlik, öz test ve geniş tarama `flock -s -n …/olcum.lock` ile (ders 52). Program açılmadı.

## 22. 2.5.0 Ç5 bakımı 10 — S122 (birden çok elle borcu içine alan karta gelen ödeme elle borçların Kalan'ını içine alma sırasıyla, eskiden yeniye düşürür) + S123 / S124 / S125 = C (BİLİNEN SINIR) (11.11.2026, `date -u` 08:36; karar 11.11.2026 — ana oturumun özet dosyası; eski kâhinler bakımı 10 — kodu görmeyen AYRI el) — kural seti `2.5.0` = §13 + … + §21 + bu bölüm

Bu bakım KÜÇÜKTÜR: bakım 9'un dört susma sınırının kullanıcı yanıtları — biri kural (S122 = A, SK-21'in sorusu), üçü BİLİNEN SINIR (S123 / S124 / S125 = C — SK-20 / SK-22 / SK-23; susma AYNEN, yalnız
neden metni). S110, S120, S2, S50, S101, S99 ve §13–§21'in öbür kuralları DEĞİŞMEZ; tek kalem içeren kartta C13.4 (7) / Y9-7 AYNEN. `--kural 2.4.9` (ve 2.4.6 / 2.4.5 / `--legacy`) AYNEN. Defter
kâhini (`test/bagimsiz/defter/`) DEĞİŞMEZ (Mevcut Borç kartı maddesizdir — elle kaydın "Kalan" sütunu yevmiyeyi değiştirmez).
**Bu bölümün ilk commit'i yalnız YORUMDUR (ders 40 — önce kural, sonra kod); senaryo / mutant / G3 sayıları kod ve kanıt commit'lerinde eklenir.**

### C00o Temiz oda (bakım 10)
- **Girdi (AYNEN; ana oturumun özet dosyası `scratchpad/kahin-eski10-kararlar.md` — "programın hesap / görünüm davranışı hakkında hiçbir bilgi içermez"):**
  - SORU S122 (bakım 9'un SK-21'i — kullanıcıya gösterilen metin AYNEN): "karta ödeme gelince hangi elle borcun "Kalan"ı düşer? Uç durum değil: birden çok elle borcu içine alan her kartta, her
    taksit ödemesinde çıkar. Örnek: F 600 + X 500 + Y 700, kart 900 (içinde X 500 + Y'nin 400'ü). Karta 300 ödeme geliyor. — A (öneri): eskiden yeniye → X Kalan 200, Y Kalan 700. — B: en yeniden →
    X Kalan 500, Y Kalan 400. Bakiye, kart kalanı, gecikmiş tutar ve takvim ikisinde de aynı; değişen yalnız elle kayıtların "Kalan" sütunu."
  - SORULAR S123 (SK-20), S124 (SK-22), S125 (SK-23) — üçü "(uç durum)", seçenek C "uç durum böyle kalsın (bilinen sınır)" (metinler girdi dosyasında AYNEN; örnekleri §21'in SK-20 / SK-22 / SK-23'ü).
  - KARAR (kullanıcı 11.11.2026, AYNEN: "s122 a şıkı, diğerleri c"): "S122 = A (PARA KURALI): Taksitler'den açılan kart birden çok elle borcu içine aldıysa karta gelen ödeme elle borçların
    'Kalan'ını kartın içine alma sırasıyla, ESKİDEN YENİYE düşürür. Örnek: fatura F 600 + elle borç X 500 + elle borç Y 700, kart 900 (içinde X 500 + Y'nin 400'ü); karta 300 ödeme ⇒ X Kalan 200,
    Y Kalan 700 (bakiye, kart kalanı, gecikmiş ve takvim değişmez). S123 = C, S124 = C, S125 = C: üçü de UÇ DURUM — BİLİNEN SINIR. Kural konmadı; kâhin SK-20, SK-22, SK-23'te SUSMAYA DEVAM EDER.
    Bu üç kayıt artık "KULLANICIYA SORULMALI" değil "BİLİNEN SINIR (kullanıcı kararı S123 / S124 / S125 = C)" diye anılır (susma davranışı değişmez; yalnız neden metni / KARARLAR başlığı)."
  - NOT (ana oturum, AYNEN): "(1) S122 yalnız kartın içine BİRDEN ÇOK elle borç aldığı durumu yanıtlar; S110, S120, S2, S50, S101 kararlarının YERİNE geçmez; tek kalem içeren kartta bakım 9'un
    kuralı aynen. (2) "Karta gelen ödeme" sözünün kapsamı (kartın taksit tahsilatı; karta pay düşen bağsız tahsilat — bakım 9'un H10 / H11 senaryolarındaki iki yol) karar metninden tek okumayla
    çıkıyorsa değer yaz; çıkmıyorsa o yolda SUS ve "KULLANICIYA SORULMALI" yaz (iki seçenek + öneri; uç durumsa üçüncü seçenek "Uç durum böyle kalsın (BİLİNEN SINIR)"). (3) Ödemenin geri
    alınması / silinmesi / düzeltilmesi sonrası 'Kalan' için karar ayrı bir şey söylemiyor: geri alınan ödeme hiç yapılmamış gibi okunabiliyorsa (kâhinin öbür geri alma kurallarıyla aynı) öyle;
    tek okuma çıkmıyorsa SUS. Kendi yorumunla kesinleştirme."
- **Birlikte okunan (kâhinin kendi belgesi):** bu dosyanın §13 C13.4 (1)–(11) ve K6.5, §20 (Y8-3 / Y8-4), §21 (bütünü — Y9-1 … Y9-9, SK-20 … SK-23, C21.1 … C21.3, C8n, C0n); `model.py` kart tüketimi
  (`_tyk`, `_s120_doldur`), defter kalanı (`_alacak_govde250`), gecikmiş (`_gecikmis_brut`), görünüm (`kontrol` hareket / fatura kalemleri), adımlar (`tahsilat`, `kart_tahsilat`, `hareket_sil`,
  `hareket_geri_yukle`, `hareket_duzenle`); d35 elle senaryosu ve onu üreten `docs/kanit/2026-11-11/kahineski9-arac/yeni-senaryolar9.py`. Okunan / okunmayan dosyaların tam listesi ajan raporunda.
- **Okunmayan:** `server/**`, `client/**`, `bulut/**`, `packaging/**`, `tools/**` (yalnız `kanit.mjs` çalıştırılır), `docs/erp/C5-ACILIS-TASARIM.md`, `docs/erp/C5B-TYK-TASARIM.md`, `docs/devir/**`,
  `docs/2.5.0-IS-LISTESI*.md` (hiçbir sürümü), `test/bagimsiz/cari/YAPIM-ASAMASI.json`, `kos.mjs`, iki kâhin klasörü dışındaki `test/**`, başka ajanların `docs/kanit/**` dosyaları (yalnız
  `kahineski9-arac/` araçları), git farkı / geçmiş içeriği. Program koşulmadı; programın davranışı aranmadı. CLAUDE.md "Açık iş"teki program durumu kural / beklenti kaynağı sayılmadı.

### Kâhinin BUGÜNKÜ (bakım 9, `ab628e61` + ana dal) okuması — S122 alanında (açıkça)
Bakım 9 kâhini S122'nin hiçbir seçeneğini DEĞER olarak yazmıyordu: S120 alanındaki (Y9-3) kart birden çok elle kalemi içine aldıysa ve kartın ödenen kısmı > 0 ise (kart tahsilatı — d35 H11; S50 ile
bağsız tahsilatın taksite düşen payı — d35 H10) cari C13.4 (11) düzeninde SUSUYORDU (Kalan / açık / kart kalanı / gecikmiş / görünüm yazılmaz; `belirsiz` "… SK-21 (§21)"); yazılanlar yalnız bakiye
ve kart tutarı. Kartın ödenen kısmı 0 iken Y9-7 ile DEĞER (Kalan = kuyruk kalanı + tüketilen). Taksitler'den açılan kart açık borca EŞİT (O = T) olup birden çok kalemi tükettiyse — kalemlerin
hepsi elle olsa bile — C13.4 (7) / (11) ile ödenen kısımdan bağımsız SUSUYORDU ("birden çok kalemi tüketti (dağılım kararda yok)"). SK-20 / SK-22 / SK-23 "KULLANICIYA SORULMALI" diye susuyordu.

### Yorumlar (ders 40 — karardan; kod yazılmadan ÖNCE; baş mimar kullanıcıya gösterir)
- **Y10-1 — kural:** Taksitler'den açılan Mevcut Borç kartının içine aldığı kalemlerin HEPSİ elle kayıt (elle Borç Yaz, borçlu Açılış) ve en az İKİ tane ise kartın ödenen kısmı P (C13.4 (7)'nin
  "kartın ödenen kısmı" — kart taksitlerinin kapanan toplamı, S101'in avansla ödenmiş saydığı kısım hariç) elle kalemlere kartın İÇİNE ALMA SIRASIYLA, eskiden yeniye, birikimli dağılır: ilk
  kalemin karttaki kısmı (tüketilen) dolana dek ona, sonra ikinciye … Her kalemin defter kalanı (Kalan; K6.5 (a)) = kuyruk kalanı + tüketilen − o kaleme düşen pay. Kararın örneği AYNEN:
  X tüketilen 500, Y tüketilen 400 (kuyruk 300); P = 300 ⇒ X 0 + 500 − 300 = 200, Y 300 + 400 − 0 = 700. Bakiye, kart kalanı, gecikmiş, takvim / Vade Takip / projeksiyon (kuyruk kalanı — Y8-4)
  DEĞİŞMEZ ("bakiye, kart kalanı, gecikmiş ve takvim değişmez"). P = 0 iken Y9-7 AYNEN.
- **Y10-2 — "karta gelen ödeme"nin kapsamı (NOT (2)) — TEK OKUMA, değer:** P kaynağına bakmaz: kart tahsilatı (karta doğrudan; d35 H11) ve kart seçilmeden alınan tahsilatın S50 ile taksite düşen
  payı (d35 H10) AYNI P'ye girer. Gerekçe (kâhinin kendi belgesinden): S122 sorusu bakım 9'un SK-21'inin sorusudur ve SK-21 (Y9-7) iki yolu birlikte tanımlıyordu ("kartın ödenen kısmı > 0 iken
  (kart tahsilatı ya da S50 ile bağsız tahsilatın taksite düşen payı)"); S50 A "kart seçilmeden alınan tahsilat ayrı taksit kartının vadesi gelmiş taksitini de kapatır (tek yükümlülük kuyruğu)" —
  kapanan taksit kartın ödenmiş taksitidir; C13.4 (7) tek kalemli kartta da P'yi kaynağa göre ayırmaz. Karar yalnız SIRAYI verdi; kaynağa göre başka bir sıra okuması metinde yok. Aynı gerekçeyle
  taksiti kapatan öbür bağsız kapatıcıların (stok Satış İadesi, Değersiz Alacak Yaz, bağ fazlası) S50 payı da P'dir (C13.4 (7) ile aynı; ayrı sıra okuması yok).
- **Y10-3 — "birden çok elle borcu içine aldıysa" — O = T kartı da (BAŞ MİMAR'IN DEĞERLENDİRMESİNE):** kararın metni kuralı S120 alanına (O > T) bağlamıyor ("Taksitler'den açılan kart birden çok
  elle borcu içine aldıysa"); soru metni de "birden çok elle borcu içine alan her kartta, her taksit ödemesinde çıkar" diyor. Bu yüzden kâhin Y10-1'i, Taksitler'den açılan kartın açık borca EŞİT
  olduğu (O = T; eski M1e kuralı — kart bütün açık borcu S2 sırasıyla tüketir) ve tükettiği kalemlerin HEPSİ elle olduğu (iki ya da daha çok) durumda da uygular; içine alma sırası M1e'nin S2 sırasıdır
  (vadesizde belge sırası). Bu durumda kâhin bakım 9'a kadar ödenen kısımdan bağımsız susuyordu (C13.4 (11) "birden çok kalemi tüketti"); artık Kalan değer alır (P = 0 iken kuyruk kalanı +
  tüketilen — Y9-7 ile aynı) ve görünüm S110 alanının kurallarıyla (Y8-4 / C20.3: takvim / Vade Takip / projeksiyon kuyruk kalanı; sayaç ve görünüm toplamı yazılmaz) yazılır. Öbür okuma
  ("S122 yalnız sorunun bağlamı — SK-21, S120 alanı") seçilirse O = T kartı eskisi gibi susar; ayrışan denetim sayısı G3'te ayrı sınıfta ("S122-OT") dökülür — ters okumaya dönmek tek koşuldur.
  Kart bir faturayı / stok satışını / karşılıksızı / başka kartın taksitini de içine aldıysa (O = T) C13.4 (7) / (11) AYNEN susar — karar yalnız ELLE borçların sırasını verdi, ödemenin fatura ile
  elle arasındaki dağılımı metinde yok.
- **Y10-4 — S125 (= C) ile çakışan alt durum — SUS (BİLİNEN SINIR):** "kartın içine alma sırası" "eskiden yeniye"dir; "eski"nin vade mi belge tarihi mi olduğu S125'te soruldu ve kullanıcı C dedi
  (kural yok). Bakım 9 yalnız iki sıranın TÜKETİMİ ayrıştığında susuyordu (SK-23). Tüketim aynı olup (örneğin elle borçların toplamı = kart, ikisi de tamamen kartta) iki sıra kalemleri FARKLI sırayla
  diziyorsa ödeme iki okumada farklı kalemden düşer → kâhin SUSAR, neden "BİLİNEN SINIR (S125 = C) SK-23". Örnek: 01.03 F 600 · 02.03 X 500 (vade 30.03) · 05.03 Y 400 (vade 10.03) · 15.03 kart 900 ·
  10.04 kart tahsilatı 300 ⇒ vade sırası Y Kalan 100, X Kalan 500 / belge sırası X Kalan 200, Y Kalan 400 (bakiye 1.200, kart kalanı 600 ikisinde aynı). İki okuma aynı payı veriyorsa (ör. kart tamamen
  ödenmiş: P = 900 ⇒ X 0, Y 0) değer.
- **Y10-5 — geri alma / silme / düzeltme (NOT (3)) — TEK OKUMA, değer:** Y10-1'in dağılımı yalnız P'nin TOPLAMINA bağlıdır (birikimli doldurma — ödemelerin sırası / sayısı sonucu değiştirmez;
  iki ödeme üst üste = toplamları tek ödeme). Kâhin her kontrolde durumu baştan kurar; silinen (Silinenler'e giden) tahsilat P'ye girmez, geri yüklenen kendi tarihinde girer (C13.4 (4) "geriye tarihli
  kayıt kendi tarihinde girmiş sayılır") → silinen ödeme hiç yapılmamış gibi; öbür geri alma kurallarıyla aynı. Tahsilat tutarının DÜZELTİLMESİ kâhinin dilinde yok (`hareket_duzenle` yalnız elle
  Borç / Alacak) → denenmedi (C12o). Kart açıldıktan sonra içine alınan elle borcun silinmesi / düzenlenmesi bu kararın konusu değil (kartın tüketimi kartın gününde baştan kurulur — C13.4 (6)
  AYNEN).
- **Y10-6 — S123 / S124 / S125 = C:** SK-20 (açık elle borçların toplamı kart tutarından az), SK-22 (karta eşit birden çok elle borç, eskiden yeniye önce başka elle borç), SK-23 (vade ↔ belge
  sırası tüketimi ayırıyor) ve Y10-4'ün alt durumu AYNEN susar (C13.4 (11) düzeni; yazılanlar yalnız bakiye ve kart tutarı); `belirsiz` nedeni "… BİLİNEN SINIR (kullanıcı kararı S123 = C) SK-20"
  / "… (S124 = C) SK-22" / "… (S125 = C) SK-23" — "KULLANICIYA SORULMALI" yazılmaz. Susan kartın tüketimi eski sırayla sürer (bakım 8 / 9 düzeni); karta ödeme gelmesi susmayı değiştirmez.
- **Y10-7 — DEĞİŞMEYEN:** tek kalem içeren kart (Y9-2 "kendi"; Y9-3'ün tek elle kalemi — kararın S120 2. / 3. örneği; O = T tek kalem) C13.4 (7) AYNEN; satışla açılan kart (Y7-2 / Y8-2),
  Tablodan Aktar kartı (Y8-6), taksitli fatura (S99), O < T (EK-2B 32 / S101), G2 (b) (Y7-3), S2 / S50 sırası, gecikmiş C13.5 / C16.4, Y8-6'nın tanım alanı.

### SK-20 … SK-23 bu kararlarla (açıkça)
| Bakım 9 | Bakım 10 |
|---|---|
| SK-20 (E < T) — KULLANICIYA SORULMALI, SUS | **BİLİNEN SINIR (S123 = C)** — SUS aynen |
| SK-21 (çok elle kalemli kart, P > 0) — KULLANICIYA SORULMALI, SUS | **DEĞER** (Y10-1; kart tahsilatı ve S50 payı — Y10-2; silme / geri yükleme — Y10-5) — yalnız Y10-4 alt durumu SUS (BİLİNEN SINIR S125 = C) |
| SK-22 (birden çok eşit elle borç, önce başka elle borç) — KULLANICIYA SORULMALI, SUS | **BİLİNEN SINIR (S124 = C)** — SUS aynen |
| SK-23 (vade ↔ belge sırası tüketimi ayırıyor) — KULLANICIYA SORULMALI, SUS | **BİLİNEN SINIR (S125 = C)** — SUS aynen; Y10-4 ile ödeme dağılımına da uygulanır |
| (C13.4 (11)) O = T, Taksitler kartı, hepsi elle, iki ya da daha çok kalem — SUS | **DEĞER** (Y10-3 — baş mimarın değerlendirmesine) |

### KULLANICIYA SORULMALI (bakım 10)
YOK — Y10-2 / Y10-5 tek okuma; Y10-4 S125 = C'nin alanı (BİLİNEN SINIR); Y10-3 karar metninin harfi (baş mimar değerlendirir; ters okuma seçilirse tek koşul).

### Kurallar (kod commit'i `2e201970`; yorumların `model.py`'deki karşılığı)
- **C22.1 (Y10-1 / Y10-2 / Y10-5) `_alacak_govde250` + `_s122_dagit`:** S120 alanındaki çok kalemli kartta (`s120_kart`, `len(tk) ≥ 2`) ya da Y10-3'ün O = T kartında kartın ödenen kısmı P = Σ taksit
  ödeneni − S101 önceden (kaynağa bakmadan: kart tahsilatının bağı, S50 ile bağsız tahsilat / kapatıcı payı) `tk`'nin sırasıyla (kartın içine alma sırası — S2) birikimli dağılır; her kalemin Kalan'ı
  = kuyruk kalanı + tüketilen − pay. P = 0 iken pay 0 (Y9-7 aynen). Ödemeler ayrı ayrı izlenmez (yalnız toplam — Y10-5); silinen tahsilat zaten kuyruğa girmez.
- **C22.2 (Y10-4):** aynı P belge tarihi sırasıyla (`(d, s)`) dağıtıldığında başka pay çıkıyorsa cari C13.4 (11) düzeninde susar; neden "Mevcut Borç kartı <no> birden çok elle borcu içine aldı ve
  kartın <P>'si ödendi — 'eskiden yeniye' vade sırası ile belge tarihi sırası ödemeyi farklı elle borçlara düşürüyor — BİLİNEN SINIR (kullanıcı kararı S125 = C) SK-23 (§22 Y10-4)".
- **C22.3 (Y10-3):** `api_kart` (Taksitler'den açılan, satış kartı değil) S110 / S120 alanı DIŞINDAKİ (tetik yok — O = T) kart, tükettiği kalemlerin hepsi `hareketler`de (elle Borç / borçlu Açılış) ve
  iki ya da daha çoksa C22.1'e girer ve carinin görünümü S110 alanının kurallarıyla yazılır (`s110 = True` — Y8-4 / C20.3). Kart fatura / stok satışı / karşılıksız / başka kartın taksitini de
  tükettiyse eski neden ("birden çok kalemi tüketti (dağılım kararda yok)") AYNEN.
- **C22.4 (Y10-6):** SK-20 / SK-22 / SK-23 nedeni "… BİLİNEN SINIR (kullanıcı kararı S123 / S124 / S125 = C) SK-2x (§21, §22)"; susma ve tüketim AYNEN.
- İz: `son["s122"]` (kart → "alan" | "ot" (+ "-odemeli") | "sus") — sonucu değiştirmez (G3 sınıflaması için).
- `--kural 2.4.9` / 2.4.6 / 2.4.5 / `--legacy`: hiçbir yol değişmedi (yeni dallar `_alacak_govde250` içinde — yalnız `2.5.0` — ya da mutant).

### C8o Nasıl bozulur? (bakım 10 — kod commit'inde, senaryolarla birlikte yazıldı)
| # | Bozulma | Senaryo |
|---|---|---|
| Z122 | Ödeme elle borçlara en yeniden düşer (S122 B) | d35 H10 / H11, d36 J1 / J2 / J4–J9 / J12 / J17a (mutant 265) |
| Z123 | Ödeme elle borçlara orantılı dağılır | d35 H10 / H11, d36 J1 / J2 / J4–J9 / J12 / J17a (mutant 266) |
| Z124 | İkinci ödemede sıra baştan başlar (önceki ödemeyi bilmez) | d36 J2 / J3 / J4 / J5 / J7 / J9 / J11 / J11b (mutant 267) |
| Z125 | Elle borca düşen pay kuyruktan da düşer (gecikmiş / takvim değişir — "takvim değişmez") | d36 J2 / J3 / J4 / J5 (mutant 268) |
| Z126 | Ödeme elle borca düşünce kartın ödeneni / kalanı değişir ("kart kalanı değişmez") | d35 H10 / H11, d36 J1–J9 / J11 (ya da J11b — araç ikisini ayırmıyor) / J12 / J17a (mutant 269) |
| Z127 | S50 payı "karta gelen ödeme" sayılmaz | d35 H10, d36 J7 / J8 / J9 |
| Z128 | Silinen ödeme sayılmaya devam eder / geri yüklenen sayılmaz | d36 J8 / J9 |
| Z129 | Tek kalem içeren kartın kuralı bozulur | d36 J10 (mutant 261 / 262) |
| Z130 | Vade ↔ belge sırası ödemeyi ayırırken kâhin değer uydurur / ayırmazken susar | d36 J11 (SUS), J11b (değer) |
| Z131 | O = T elle kartı (Y10-3) susar ya da faturalı O = T kartında değer uydurulur | d36 J12 / J12b (değer), J13 (SUS) |
| Z132 | SK-20 / SK-22 / SK-23 susması karta ödeme gelince bozulur ya da neden "KULLANICIYA SORULMALI" kalır | d36 J14 / J15 / J16, d35 H3 / H8 / H9a |
| Z133 | Aynı adlı iki carinin ödemesi / kartı karışır | d36 J17a / J17b |

### Senaryolar (bakım 10; elle tablolar — kâhin koşulmadan karar metninden ve §13 / §20 / §21 / §22'den; betikler `docs/kanit/2026-11-11/kahineski10-arac/yeni-senaryolar10.py`, `d35-guncelle10.py`, adımların yeri `g1-sirala.py`)
- **`d36-c5-s122-kart-odemesi`** (bugün 15.04.2026; 362 elle denetim = 328 değer + 29 yok + 5 belirsiz): J1 ödeme X'in karttaki kısmını tam bitirir (X 0, Y 700) · J2 aşıp ikinciye geçer (X 0, Y 500) ·
  J3 kartı kapatır (X 0, Y 300) · J4 iki ödeme üst üste 300 + 300 (X 0, Y 600) · J5 üç elle borç, ödeme 700 (X 0, Y 0, Z 400) · J6 kısmen ödenmiş elle borç (X 200, Y 700) · J7 S50 payı 600
  (X 0, Y 300) · J8 silme (X 200, Y 400) · J9 silme + geri yükleme (X 0, Y 300) · J10 tek kalem (Borç 600 — değişmedi) · J11 SUS (S125 = C; vade sırası Y 100 / X 500 ↔ belge X 200 / Y 400) ·
  J11b değer (kart tamamen ödenmiş: X 0, Y 0) · J12 / J12b O = T elle kartı (X 200 / Y 400; ödemesiz X 500 / Y 400) · J13 O = T faturalı kart SUS (aynen) · J14 / J15 / J16 SK-20 / SK-22 / SK-23 + ödeme
  SUS (BİLİNEN SINIR) · J17a kararın örneği AYNEN (kart tahsilatı 300 ⇒ X 200, Y 700) / J17b aynı adlı kartsız cari.
- **`d35-c5-s120-elle-borclar` H10 / H11 (bakım 9'un SK-21'i — karar gereği değişti):** 12 `elleYok` + 2 `elleBelirsiz` (SK-21) KALKTI, 38 elle değer EKLENDİ — H10 (S50 payı 300): X Kalan 200,
  Y Kalan 400, F 0, gecikmiş 0, açık 600, kart 900 / 300 ([300, 0, 0]); H11 (kart tahsilatı 300 — kararın örneği AYNEN): X Kalan 200, Y Kalan 700, F 600, gecikmiş 900, açık 1.500, Y takvim 300 (−41),
  kart 900 / 300. H3 / H8 / H9a'nın `elleBelirsiz` kaydına "BİLİNEN SINIR" + "S124 / S123 / S125 = C" eklendi (Y10-6). Adımlar ve öbür beklentiler AYNEN. d35 toplam 366 elle denetim (bakım 9: 342).
- **İlk koşu:** 728 elle denetimin (d36 362 + d35 366) hepsi kâhinle aynı (koşudan sonra değişen elle değer YOK). Elle değerler yazılmadan önce kâhin S122 alanında koşulmadı / çıktısına bakılmadı.

### C10o Mutantlar (bakım 10; `oz-test.py` DEĞERLE — çökmeden, elle tablo kırmızı)
265 S122 B (en yeniden) · 266 orantılı dağılım · 267 her taksit ödemesi baştan (önceki ödemeyi bilmez) · 268 pay kuyruktan da düşer (gecikmiş / takvim değişir) · 269 kartın ödeneni / kalanı değişir.
Bakım 6 / 7 / 8 / 9 mutantları (241–264) aynen yakalanıyor. Bakiye bu yoldan değişemez (kâhinde bakiye hareketlerden ayrı hesaplanır, dağılım ona dokunmaz) — "açık toplamı = bakiye"
(`acikEsitBakiye`) her değer carisinde elle tabloda; bakiye bozulması bu bakımda mutantla kurulamadı (DENENMEYEN).

### Dil ekleri (/3, bakım 10)
Yeni adım YOK; yeni çıktı anahtarı YOK. `hareket_sil` / `hareket_geri_yukle` adımına isteğe bağlı `cari` alanı (yalnız `g1-sirala.py`'nin cari kuyruğu için — kâhin okumaz). `belirsiz` kayıtları: "… BİLİNEN
SINIR (kullanıcı kararı S123 = C) SK-20 (§21, §22)" (S124 / SK-22, S125 / SK-23 aynı düzen) ve "Mevcut Borç kartı <no> birden çok elle borcu içine aldı ve kartın <P>'si ödendi — 'eskiden yeniye' vade sırası
ile belge tarihi sırası ödemeyi farklı elle borçlara düşürüyor — BİLİNEN SINIR (kullanıcı kararı S125 = C) SK-23 (§22 Y10-4)". SK-21 kaydı artık yazılmaz.

### Eşleme notları (ana oturum için; `kos.mjs` bu bakımda DEĞİŞMEDİ, açılmadı)
- Yeni adım / anahtar yok; d36 bakım 7–9'un adım türleriyle (`cari_ac`, `fatura`, `borc {vade}`, `tahsilat`, `kart_ac {mevcut}`, `kart_tahsilat`, `hareket_sil`, `hareket_geri_yukle`). `hareket_sil` /
  `hareket_geri_yukle` adımlarındaki `cari` alanını `kos.mjs` yok sayabilmeli (eski senaryolarda yok) — ana oturum denetler.
- **Ana oturuma:** `model.py` değişti — mobil yazma kâhininin `cari_model_sha256`'sı yeniden üretilmeli (o dosya okunmadı); yapım aşaması listesi bu ajanca açılmadı (d35 H10 / H11, d36 — listeye yeni
  kayıt olarak düşebilir; ayrıştırma ana oturumda).

### C12o DENENMEYEN (bakım 10; neden)
- Program koşulmadı (görev). Programın S122 alanındaki gösterimi bilinmiyor.
- Tahsilat tutarının düzeltilmesi (dilde adım yok — `hareket_duzenle` yalnız Borç / Alacak); kart tahsilatının silinmesi (kart tahsilatı `hareketler`e yazılmıyor — dilde silme yolu yok; silme
  bağsız tahsilatla denendi, J8 / J9).
- Stok Satış İadesi / Değersiz Alacak'ın S50 payıyla taksit kapanması (Y10-2 aynı P) — elle senaryo yazılmadı (kural yolu aynı: kart taksitinin kapanan toplamı).
- Aynı caride iki S122 kartı; Ödeme Sözü taşıyan elle borç; vade günü / gün dönümü; iki şirket / yedek geri yükleme (kâhinin dilinde şirket yok).
- Bakiye bozan mutant (yukarıda).

### C0o Değişen eski beklentiler (G3; bakım 9 (`4d5ea01f` ağacı — çalışma dalı ucu) ↔ bakım 10 kâhin çıktısı, `2.5.0`; eski kopyanın 89 elle senaryosu + d36 + rastgele s1 / ux18 tohum 1–10 × 120) — kararla ilgisiz eski beklenti DEĞİŞMEDİ
Eski 47.167 → yeni 47.499 denetim; değişen / kalkan / yeni toplam **332**, hepsi **yeni** (bakım 9'un sustuğu yerde artık değer): S122-alan 292 + S122-OT 40; **BEKLENMEYEN 0**, değeri değişen 0, kalkan 0,
yalnız etiketi değişen 0 (dökümü `docs/kanit/2026-11-11/kahineski10-g3-dokum-*.json` — iki saat diliminde bayt bayt aynı; özet `kahineski10-esdeger-cari-*.log`). Sınıf, yeni modelin `son["s122"]` izinden cari cari:
- **d35 (44 yeni, S122-alan):** H10 22 (S50 payı), H11 22 (kart tahsilatı) — bakım 9 SK-21 ile susuyordu. Öbür H carilerinde fark 0 (H3 / H8 / H9a'nın susması aynen — yalnız `belirsiz` metni; G3 denetim
  kümesine girmez).
- **d36 (288 yeni; dosya yeni, eski kâhinde de koşuldu):** S122-alan 248 — J1 / J2 / J3 / J4 / J6 / J7 / J8 / J9 22'şer, J5 28, J11b 22, J17a 22 (eski kâhin SK-21 ile susuyordu); S122-OT 40 — J12 25,
  J12b 15 (eski kâhin "birden çok kalemi tüketti" ile susuyordu — Y10-3; ters okuma seçilirse yalnız bu 40 denetim kalkar). Fark 0: J10 (tek kalem — aynen), J11 (iki kâhinde de susar: SK-21 → S125), J13
  (aynen susar), J14 / J15 / J16 (aynen susar), J17b.
- **Öbür 88 eski elle senaryo ve 20 rastgele: fark 0** (adımları değişen eski senaryo 0; O = T elle kartı eski elle senaryolarda yok).
- **Eski ELLE tablolarda değişen beklentiler** (`kahineski10-elle-fark-*.log`; yalnız d35, karar gereği): H10 / H11 — 12 `elleYok` + 2 `elleBelirsiz` (SK-21) kalktı, 38 değer eklendi; H3 / H8 / H9a —
  `elleBelirsiz` kaydına "BİLİNEN SINIR" + "S124 / S123 / S125 = C" eklendi (3 kalktı + 3 eklendi). Öbür 88 dosyanın elle tablosu ve bütün dosyaların adımları AYNI.
- `--kural 2.4.9` / 2.4.6 / 2.4.5 / `--legacy`: **440/440 bayt bayt aynı** (89 eski elle + d36 + 20 rastgele × 4 kip); üretici 20/20 aynı dizi.
- **Yeni / değişen elle tablolar ESKİ (bakım 9) kâhinde — beklenen NEDENLE kırmızı (ders 7, 38):** 728 elle denetimin **279**'u (`kahineski10-kirmizi-eski-cari-*.log`; d36 240, d35 39): 272'si
  "ANAHTAR YOK" (eski kâhin SK-21 / "birden çok kalemi tüketti" ile susuyor), 7'si `belirsiz` kaydında "BİLİNEN SINIR" / "S12x = C" yok (eski kâhin "KULLANICIYA SORULMALI" yazıyor); 449'u iki kâhinde
  aynı (bakiyeler, kart tutarları, tek kalem J10, susan J13–J16'nın değerleri, d35'in öbür carileri, J17b).

### Kanıt (bakım 10; iki saat dilimi — UTC ve Europe/Istanbul çıktıları bayt bayt aynı (başlık satırları dışında); kâhin `2e201970`, temiz ağaç; `docs/kanit/2026-11-11/kahineski10-*`, araçlar ve koşu betiği `kahineski10-arac/`)
cari öz test **4.876/4.876** (`-cari-oz-*`: elle tablolar 90 senaryo, mutantlar 200–269 — 219–269 değerle) · mutasyon taraması **236/236** (`-cari-mutasyon-*`) · eşdeğerlik + G3 **550/550**
(`-esdeger-cari-*`) · yeni / değişen elle tablo **728/728** (`-elle-yeni-cari-*`: d36 362 + d35 366) · ESKİ kâhinde **279 kırmızı** / 728 (`-kirmizi-eski-cari-*`) · eski elle tablo farkı **89/89** izinli
(`-elle-fark-*`) · G1 tarama **90/90** (`-g1-tara-*`) · mutant ↔ senaryo **18/18** (`-mutant-senaryo-*`) · geniş tarama **2.201/2.201** (`-genis-tarama-*`; bakım 9 ile aynı sayı). **Defter öz testi
BAŞARISIZ** (`-defter-oz-*`; `VARSAYILAN_KURAL` AttributeError) — bakım 9'daki gibi, TABANDA da aynı; bu bakım defter kâhinine dokunmadı. Öz test, mutasyon, eşdeğerlik ve geniş tarama
`flock -s -n …/olcum.lock` ile (ders 52). Program açılmadı.

### KULLANICIYA SORULMALI — ek (bakım 10 sırasında görüldü; S122'nin DIŞINDA, eski C13.4 (7) / (11) sınırı — kâhin bu durumda SUSAR, değişmedi)
- **SK-24 (Taksitler'den açılan kart carinin bütün açık borcuna EŞİT ve içine bir fatura da girdi — karta ödeme gelince hangi kalemin Kalan'ı / açığı düşer; UÇ DURUM DEĞİL: "bakiye kadar kart"ta birden
  çok fatura / kayıt varsa her taksit ödemesinde çıkar):** d36 J13 — 01.03 fatura F 600 · 02.03 elle borç X 300 · 15.03 kart 900 (kartta F 600 + X 300) · 10.04 kart tahsilatı 300. **A (öneri — S122'nin
  genellemesi: kartın içine alma sırasıyla, eskiden yeniye, fatura dahil):** F açık 300, X Kalan 300. / **B (önce elle borçlar, sonra faturalar):** X Kalan 0, F açık 600. (Bakiye 600, kart kalanı 600,
  gecikmiş, takvim iki seçenekte aynı; değişen faturanın açığı ve elle kaydın Kalan'ı.) Yanıta kadar kâhin "birden çok kalemi tüketti" ile susar (bakım 9'a kadarki gibi).

## 23. 2.5.0 Ç5 bakımı 11 — S126 (bakiye kadar açılan, içine fatura da giren Taksitler kartına gelen ödeme kalemleri fatura DAHİL kartın içine alma sırasıyla, eskiden yeniye düşürür) (11.11.2026, `date -u` 13:04; karar 11.11.2026 — ana oturumun özet dosyası; eski kâhinler bakımı 11 — kodu görmeyen AYRI el) — kural seti `2.5.0` = §13 + … + §22 + bu bölüm

Bu bakım KÜÇÜKTÜR: tek kullanıcı kararı (S126 — bakım 10'un SK-24 sorusunun yanıtı); yalnız C13.4 (7) / (11)'in "Mevcut Borç kartı birden çok kalemi tüketti" susmasının bir kolunu (Taksitler'den
açılan, açık borca EŞİT (O = T) kart, içine fatura da girdi) değer alanına çevirir. S110 (§20), S120 (§21), S122 (§22 Y10-1 … Y10-7 — yalnız elle kalemli kart), S2, S50, S99, S101 ve §13–§22'nin
öbür kuralları DEĞİŞMEZ; tek kalem içeren kartta C13.4 (7) AYNEN. `--kural 2.4.9` (ve 2.4.6 / 2.4.5 / `--legacy`) AYNEN. Defter kâhini (`test/bagimsiz/defter/`) DEĞİŞMEZ (Mevcut Borç kartı
maddesizdir — C13.2 / kitap H-02; faturanın açığı ve elle kaydın "Kalan" sütunu yevmiyeyi değiştirmez).
**Bu bölümün ilk commit'i yalnız YORUMDUR (ders 40 — önce kural, sonra kod); senaryo / mutant / G3 sayıları kod ve kanıt commit'lerinde eklenir.**

### C00p Temiz oda (bakım 11)
- **Girdi (AYNEN; ana oturumun özet dosyası `scratchpad/kahin-eski11-kararlar.md` — "programın hesap / görünüm davranışı hakkında hiçbir bilgi içermez"):**
  - SORU (kullanıcıya gösterilen metin — AYNEN): "S126 — bakiye kadar açılan kartta ödeme hangi kalemi düşürür? Uç durum değil: müşterinin bütün borcu taksitlendirildiğinde her taksit ödemesinde
    çıkar. Taksitler'den açılan kart carinin bütün açık borcuna eşit ve içinde fatura da var. Örnek: fatura F 600 + elle borç X 300, kart 900. Karta 300 ödeme geliyor. — A (öneri): S122'deki
    kuralın aynısı, fatura dahil eskiden yeniye → F açık 300, X Kalan 300. — B: önce elle borçlar → X Kalan 0, F açık 600. Bakiye, kart kalanı, gecikmiş tutar ve takvim ikisinde de aynı; değişen
    yalnız hangi kalemin "ödendi" göründüğü."
  - Aynı iletide bilgi olarak gösterilen (AYNEN; "kullanıcı itiraz etmedi → kalır"): "S122 = A kuralı, bakiye kadar açılan ve içindeki kalemlerin hepsi elle borç olan karta da uygulanır (örnek: X 500 +
    Y 400, kart 900, ödeme 300 → X Kalan 200, Y 400) — bakım 10'un Y10-3'ü."
  - KARAR (kullanıcı 11.11.2026, AYNEN: "a"): "S126 = A (PARA KURALI): Taksitler'den açılan kart carinin BÜTÜN açık borcuna eşitse ve içine fatura da girdiyse karta gelen ödeme kalemleri S122'deki
    kuralın aynısıyla, fatura DAHİL kartın içine alma sırasıyla, ESKİDEN YENİYE düşürür. Örnek: fatura F 600 + elle borç X 300, kart 900; karta 300 ödeme ⇒ F açık 300, X Kalan 300 (bakiye, kart
    kalanı, gecikmiş ve takvim değişmez)."
  - NOT (ana oturum, AYNEN): "(1) karar yalnız "açık borca EŞİT kart, içinde fatura + elle borç" durumunu yanıtlar; S110, S120, S122, S2, S50, S99, S101 kararlarının YERİNE geçmez. (2) Kartın içine
    giren öbür kalem türleri (yalnız faturalar — elle borç yok; stok veresiye satışı; karşılıksız kalemi; başka kartın taksiti …) ve "eskiden yeniye"nin vade ↔ belge sırası ayrışması (S125 = C
    BİLİNEN SINIR) için karar ayrı bir şey söylemiyor: kararın metninden ve kâhinin yürürlükteki kurallarından TEK okuma çıkıyorsa değer yaz (gerekçesiyle), çıkmıyorsa o alt durumda SUS ve
    "KULLANICIYA SORULMALI" yaz (iki seçenek + öneri; uç durumsa üçüncü seçenek "Uç durum böyle kalsın (BİLİNEN SINIR)"). (3) "Karta gelen ödeme"nin iki yolu (kartın taksit tahsilatı; karta pay
    düşen bağsız tahsilat) için bakım 10'un Y10-2 okuması geçerli sayılır. (4) Fatura açığı ile cari "açık toplamı = bakiye" değişmezi her değer carisinde elle tabloda denetlenir. Kendi yorumunla
    kesinleştirme."
- **Birlikte okunan (kâhinin kendi belgesi):** bu dosyanın §13 C13.4 (1)–(11) ve C13.5, K6.5 (a) / (1), §20 (Y8-3 / Y8-4 / C20.3), §21 (Y9-1 … Y9-9, C21.1 … C21.3), §22 (bütünü — Y10-1 … Y10-7,
  SK-24, C22.1 … C22.4, C8o, C0o), §18'in EK-2B 32 / S101 geçen başlıkları; `model.py` kart tüketimi (`_tyk`, `_s120_doldur`), dağılım (`_s122_dagit`), defter kalanı (`_alacak_govde250`), görünüm
  (`kontrol` hareket / fatura kalemleri, `_cari_kalemleri`, `kontrol_acik_toplam`); d36 elle senaryosu ve onu üreten `docs/kanit/2026-11-11/kahineski10-arac/yeni-senaryolar10.py`. Okunan / okunmayan
  dosyaların tam listesi (satır aralıklarıyla) ajan raporunda.
- **Okunmayan:** `server/**`, `client/**`, `bulut/**`, `packaging/**`, `tools/**` (yalnız `kanit.mjs` çalıştırılır), `docs/erp/C5-ACILIS-TASARIM.md`, `docs/erp/C5B-TYK-TASARIM.md`, `docs/devir/**`,
  `docs/2.5.0-IS-LISTESI*.md` (hiçbir sürümü), `test/bagimsiz/cari/YAPIM-ASAMASI.json`, `kos.mjs`, iki kâhin klasörü dışındaki `test/**`, başka ajanların `docs/kanit/**` dosyaları (yalnız
  `kahineski10-arac/` araçları), git farkı / geçmiş içeriği. Program koşulmadı; programın davranışı aranmadı. CLAUDE.md "Açık iş"teki program durumu kural / beklenti kaynağı sayılmadı.

### Kâhinin BUGÜNKÜ (bakım 10, `2e201970` + ana dal `3aa793fb`) okuması — S126 alanında (açıkça)
Bakım 10 kâhini S126'nın hiçbir seçeneğini DEĞER olarak yazmıyordu: Taksitler'den açılan kart açıldığı anda carinin açık borcuna EŞİT (O = T; S110 / S120 tetiği yok — M1e kartı bütün açık borcu S2
sırasıyla tüketir) ve tükettiği kalemlerden en az biri elle kayıt DEĞİLSE (fatura, stok veresiye satışı, karşılıksız kalemi, başka kartın / taksitli faturanın taksiti) cari C13.4 (11) düzeninde
— kartın ödenen kısmından BAĞIMSIZ (ödeme 0 iken de) — SUSUYORDU (`belirsiz` "Mevcut Borç kartı <no> birden çok kalemi tüketti (dağılım kararda yok)"; Kalan / fatura açığı / kart kalanı / gecikmiş /
görünüm yazılmaz; yazılanlar yalnız bakiye ve kart tutarı). Kararın örneği d36 J13'tür (01.03 F 600 · 02.03 X 300 · 15.03 kart 900 · 10.04 kart tahsilatı 300 — aynı tarih ve tutarlarla; bakım 10'un
SK-24'ü).

### Yorumlar (ders 40 — karardan; kod yazılmadan ÖNCE; baş mimar kullanıcıya gösterir)
- **Y11-1 — alan:** S126 yalnız şu kartta uygulanır: Taksitler'den açılan Mevcut Borç kartı (satışla açılan kart değil — Y7-2 / Y8-2; Tablodan Aktar kartı değil — Y8-6), açıldığı anda O = T (S110'un
  tetiği O > T değil — §20 Y8-1; S101'in O < T'si değil — EK-2B 32 / §18), M1e ile İKİ ya da daha çok kalem tüketmiş ve tükettiği kalemler yalnız taksitsiz satış faturası ve elle kayıt (elle Borç
  Yaz, borçlu Açılış — Y8-3 (ii)) olup en az BİRİ fatura ("içine fatura da girdiyse"). Hepsi elle ise bakım 10 Y10-3 AYNEN (değişmedi; S126 iletisindeki bilgi notu da bunu teyit ediyor). Tek kalem
  içeren kart C13.4 (7) AYNEN.
- **Y11-2 — kural ("S122'deki kuralın aynısı, fatura DAHİL"):** kartın ödenen kısmı P (Y10-1'in P'si: kart taksitlerinin kapanan toplamı, S101'in avansla ödenmiş saydığı kısım hariç) kartın tükettiği
  kalemlere kalem TÜRÜNE BAKMADAN kartın İÇİNE ALMA SIRASIYLA (M1e'nin sırası = S2: vade → belge → yazım; satış faturasında vade = belge günü — C13.4 (1); vadesiz elle kayıtta vade = belge günü — S1
  A), eskiden yeniye, birikimli dağılır: ilk kalemin karttaki kısmı (tüketilen) dolana dek ona, sonra ikinciye … Her kalemin defter kalanı (K6.5 (a); C13.4 (7)) = kuyruk kalanı + tüketilen − o kaleme
  düşen pay — faturada `fatura:<ad>:acik`, elle kayıtta Kalan. Kararın örneği AYNEN: F tüketilen 600, X tüketilen 300; P = 300 ⇒ F 0 + 600 − 300 = 300 (açık), X 0 + 300 − 0 = 300 (Kalan). Bakiye,
  kart kalanı / ödeneni, gecikmiş (C13.5 — kuyruk kalanı), takvim / Vade Takip / projeksiyon (kuyruk kalanı — Y8-4) DEĞİŞMEZ ("bakiye, kart kalanı, gecikmiş ve takvim değişmez").
- **Y11-3 — P = 0 (kartın hiç ödenmemiş hâli):** dağılım sorusu doğmuyor (Y9-7 / Y10-1 ile aynı) → her tüketilen kalemin defter kalanı = kuyruk kalanı + tüketilen (F açık 600, X Kalan 300). Bakım 10'a
  kadar bu da susuyordu; C13.4 (7)'nin formülü tek okuma verir (değer).
- **Y11-4 — "karta gelen ödeme"nin iki yolu (NOT (3)):** Y10-2 AYNEN — P kaynağına bakmaz: kart tahsilatı (karta doğrudan) ve kart seçilmeden alınan tahsilatın (ve öbür bağsız kapatıcıların) S50 ile
  taksite düşen payı AYNI P'ye girer.
- **Y11-5 — geri alma / silme:** Y10-5 AYNEN — dağılım yalnız P'nin TOPLAMINA bağlıdır (iki ödeme üst üste = toplamları tek ödeme); silinen tahsilat P'ye girmez, geri yüklenen kendi tarihinde girer.
- **Y11-6 — kapsam "fatura da" — sayı sınırı yok:** iki ya da daha çok fatura + bir ya da daha çok elle kayıt da S126'nın alanıdır (karar kalem sayısı koymuyor; kural Y11-2 aynen). Elle kayıt faturadan
  ESKİ ise sıra kendiliğinden tersine döner (kartın içine alma sırası — örnek: 01.03 X 300 · 05.03 F 600 · kart 900 · ödeme 300 ⇒ X Kalan 0, F açık 600; bu B'nin değil A'nın sonucudur — sırayı tür
  değil tarih belirliyor).
- **Y11-7 — yalnız faturalar (elle kayıt YOK; iki ya da daha çok fatura) — DEĞER (BAŞ MİMAR'IN DEĞERLENDİRMESİNE) [bakım 12 §24 Y12-11: not KALKTI — kullanıcıya gösterildi, itiraz etmedi]:** kâhinin okuması: kararın işleyen cümlesi "karta gelen ödeme kalemleri … fatura
  DAHİL kartın içine alma sırasıyla, ESKİDEN YENİYE düşürür" kalem türüne göre sıra koymuyor; S126'nın A ↔ B ayrımı yalnız fatura ile elle kayıt ARASINDAKİ önceliğiydi (B "önce elle borçlar") — elle kayıt
  yoksa B'nin ayırıcı kolu boştur ve geriye yalnız "eskiden yeniye" kalır; S122 (hepsi elle) ve S126 (karışık) aynı sırayı verdiğinden faturalar arasında başka bir sıra kullanıcı kararlarının ikisiyle
  de çelişir. Öbür okuma ("fatura DA" sözü elle kaydın varlığını şart koşar — yalnız faturalı kart kararın dışında) seçilirse yalnız faturalı kart eskisi gibi SUSAR (başka bir DEĞER çıkmaz); ayrışan
  denetim sayısı G3'te ayrı sınıfta ("S126-F") dökülür — ters okumaya dönmek tek koşuldur.
- **Y11-8 — S125 (= C) ile çakışan alt durum — SUS (BİLİNEN SINIR), Y10-4 AYNEN:** O = T kartta tüketim iki sırada da aynıdır (her kalem tamamen kartta), ama vadeli elle kayıt (Vade Tarihi belge
  gününden sonra) iki sıranın kalemleri FARKLI dizmesine yol açabilir → ödeme vade sırasıyla başka, belge tarihi sırasıyla başka kalemden düşer → kâhin SUSAR, neden "BİLİNEN SINIR (S125 = C) SK-23".
  Örnek: 01.03 X 300 (vade 30.03) · 05.03 F 600 · 15.03 kart 900 · 10.04 kart tahsilatı 300 ⇒ vade sırası F açık 300, X Kalan 300 / belge sırası X Kalan 0, F açık 600 (bakiye 600, kart kalanı 600
  ikisinde aynı). İki sıra aynı payı veriyorsa (kart tamamen ödenmiş; ya da vadeli kayıt sırayı değiştirmiyor) DEĞER.
- **Y11-9 — öbür kalem türleri kartın içindeyse (NOT (2): stok veresiye satışı, karşılıksız çek / senet kalemi, başka taksit kartının taksiti, taksitli faturanın taksiti) — SUS, KULLANICIYA SORULMALI
  (SK-25) [bakım 12 §24: S128 = A — Y12-2 / Y12-3; SK-25 kalktı]:** karar "fatura DAHİL" dedi; bu kalemler ne fatura ne elle kayıt. İki okuma: (a) kararın genellemesi — türüne bakmadan eskiden yeniye; (b) S126'nın alanı fatura + elle kayıt, öbür kalemler
  sırada sona (ya da başka bir önceliğe) kalır. Kararın metni ikisini ayırmıyor → kâhin o caride C13.4 (11) düzeninde susar (yazılanlar yalnız bakiye ve kart tutarı); neden "… KULLANICIYA SORULMALI
  SK-25 (§23)". (Kâhinin dilinde stok veresiye satışının ve karşılıksız kaleminin "açık" sütunu yok — ama elle kaydın Kalan'ı / faturanın açığı o kalemin sıradaki yerine bağlıdır.)
- **Y11-10 — görünüm (Y8-4 / C20.3 AYNEN, S110 alanının kuralları):** S126 kartlı caride Kalan / fatura açığı defter kalanıdır (Y11-2); takvim / Vade Takip / projeksiyon tutarı kuyruk kalanıdır.
  Kartın tamamen içine aldığı satış faturası takvim kalemi DEĞİLDİR (`takvim:fatura:<ad>` = "yok"): kuyruk kalanı 0 (Y8-4) ve K6.5 (1)'in "kartlı caride fatura kalemi NET (açık − kartın açık kapsamı)"
  kuralı aynı sonucu verir (örnekte 300 − (600 − 300) = 0) — tek okuma ("takvim değişmez"). Sayaç ve görünüm toplamı yazılmaz (kâhinin sınırı — Y8-4).
- **Y11-11 — NOT (4):** her değer carisinde elle tabloda `acikToplam` (Σ fatura açığı + Σ elle Kalan) = bakiye ve `acikEsitBakiye` = true denetlenir (dağıtılmamış para yokken).
- **Y11-12 — DEĞİŞMEYEN:** S120 kartı (O > T) faturayı içine almaz (Y9-3 — S126'nın alanına girmez); Y9-2 "kendi" kartı (tek kalem); satışla açılan kart (Y7-2); Tablodan Aktar kartı (Y8-6 —
  çok kalem tükettiyse "birden çok kalemi tüketti" ile AYNEN susar); S101 (O < T); taksitli fatura (S99) ve iadesi (C13.4 (11)); faturanın satış iadesi; karşı yönlü kalemli kartlı cari (C16.2);
  SK-20 / SK-22 / SK-23 (S123 / S124 / S125 = C — §22 Y10-6); S2 / S50 sırası; gecikmiş C13.5 / C16.4.

### SK-24'ün ve C13.4 (7) / (11)'in durumları bu kararla (açıkça)
| Durum (Taksitler kartı, O = T, ≥ 2 kalem tüketti) | Bakım 10 | Bakım 11 (S126 A) |
|---|---|---|
| hepsi elle (Y10-3) | DEĞER | DEĞER — değişmedi |
| fatura + elle (SK-24; kararın örneği; iki fatura + elle; elle faturadan eski) | SUS (P'den bağımsız) | **DEĞER** (Y11-2 / Y11-3 / Y11-6) — Y11-8 alt durumu dışında |
| yalnız faturalar (≥ 2) | SUS | **DEĞER** (Y11-7 — baş mimarın değerlendirmesine; ters okuma = SUS, sınıf S126-F) |
| vadeli elle kayıt ödemeyi iki sırada farklı kaleme düşürüyor | SUS | **SUS** — BİLİNEN SINIR (S125 = C) SK-23 (Y11-8) |
| içinde stok veresiye satışı / karşılıksız kalemi / başka kartın ya da taksitli faturanın taksiti | SUS | **SUS** — KULLANICIYA SORULMALI SK-25 (Y11-9) |
| Tablodan Aktar kartı çok kalemli | SUS | SUS — değişmedi |

### KULLANICIYA SORULMALI (bakım 11; kâhin bu durumda SUSAR — ders 43, SORU DÜZENİ)
- **SK-25 (bakiye kadar açılan Taksitler kartının içinde fatura ve elle borç DIŞINDA bir kalem de var — stok veresiye satışı, karşılıksız çek / senet borcu, başka taksit kartının ya da taksitli faturanın
  taksiti; karta ödeme gelince hangi kalem önce düşer; UÇ DURUM):** 01.03 stok veresiye satışı S 400 · 02.03 elle borç X 300 · 15.03 kart 700 (kartta S 400 + X 300) · 10.04 kart tahsilatı 300.
  **A (öneri — S126'nın genellemesi: türüne bakmadan kartın içine alma sırasıyla, eskiden yeniye):** S'nin açığı 100, X Kalan 300. / **B (önce fatura ve elle borçlar, öbür kalemler en sonda):**
  X Kalan 0, S'nin açığı 400. / **C:** uç durum böyle kalsın (BİLİNEN SINIR). (Bakiye 400, kart kalanı 400, gecikmiş ve takvim üç seçenekte aynı.)

### Kurallar (kod commit'i; yorumların `model.py`'deki karşılığı)
- **C23.1 (Y11-1 / Y11-7 / Y11-9) `_alacak_govde250`:** `ot_` = Taksitler kartı (`api_kart`, S110 / S120 alanı dışında — O = T) ve ≥ 2 kalem tüketti; tüketilen her kalemin türü `tur_` ("e" elle Borç / borçlu Açılış
  — `hareketler`, "f" taksitsiz satış faturası — `satis`, "o" öbür). `ot_elle` (hepsi "e") bakım 10 Y10-3 AYNEN; `ot_fat` (hepsi "e" / "f", en az bir "f" — yalnız faturalar da) S126; en az bir "o"
  → neden "… KULLANICIYA SORULMALI SK-25 (§23 Y11-9)" (C13.4 (11) düzeni; eski "birden çok kalemi tüketti" nedeninin YERİNE, susma aynen).
- **C23.2 (Y11-2 / Y11-3 / Y11-4 / Y11-5):** `ot_fat` kartı C22.1'in yoluna girer: P = Σ taksit ödeneni − S101 önceden; `_s122_dagit(tk, tk'nin sırası, P)` (türüne bakmadan, kartın içine alma sırası — S2) →
  her kalemin `acik` (faturada belge açığı, elle kayıtta Kalan) = kuyruk kalanı + tüketilen − pay; P = 0 iken pay 0. Görünüm S110 alanının kurallarıyla (`s110 = True`).
- **C23.3 (Y11-8):** belge tarihi sırasıyla (`(d, s)`) dağıtım başka pay veriyorsa SUS — neden "… carinin bütün açık borcunu (fatura dahil — S126) içine aldı ve kartın <P>'si ödendi — … BİLİNEN SINIR
  (kullanıcı kararı S125 = C) SK-23 (§22 Y10-4, §23 Y11-8)".
- **C23.4 (Y11-10) görünüm (`kontrol` fatura kalemleri):** S110 alanındaki caride kartın tükettiği satış faturası `takvim:fatura:<ad>` = kuyruk kalanı (> 0 ise `{amount, direction}`, değilse "yok");
  bakım 10'a kadar bu kalem S110 alanında hiç yazılmıyordu (alanın kartları fatura tüketmiyordu). Vade Takip / projeksiyon / sayaç / görünüm toplamı S110 alanında yazılmaz (Y8-4 aynen).
- İz: `son["s122"]` kart → … | "s126" | "s126f" (+ "-odemeli") | "sus" | "sk25"; `son["s126_fpay"]` (faturaya düşen pay — yalnız mutant 273). Sonucu değiştirmez.
- `--kural 2.4.9` / 2.4.6 / 2.4.5 / `--legacy`: hiçbir yol değişmedi (yeni dallar `_alacak_govde250` / `kontrol`'ün `k250` kolunda ya da mutant).

### C8p Nasıl bozulur? (bakım 11 — kod commit'inde, senaryolarla birlikte yazıldı)
| # | Bozulma | Senaryo |
|---|---|---|
| Z134 | Ödeme önce elle borçlara düşer (S126 B) | d37 L1 / L2 / L3 / L5 / L7 / L8 / L9 / L10 / L16a, d36 J13 (mutant 270) |
| Z135 | Ödeme en yeniden düşer | d37 L1 / L2 / L3 / L5 … L10 / L12 / L13c / L15 / L16a, d36 J13 (mutant 265) |
| Z136 | Ödeme orantılı dağılır | d37 L1 / L2 / L3 / L5 … L10 / L12 / L13c / L15 / L16a, d36 J13 (mutant 266) |
| Z137 | Ödeme yalnız faturanın açığını / yalnız elle kaydın Kalan'ını düşürür | d37 L3 / L4 / L5 / L6 / L7 / L13b / L13c / L15 (mutant 271); d37 L1 / L2 / L3 / L4 / L5 / L7 / L8 / L9 / L10 / L12 / L13b / L16a, d36 J13 (mutant 272) |
| Z138 | Faturaya düşen pay bakiyeyi / kart kalanını / gecikmişi de değiştirir ("değişmez") | bakiye: d37 L1 … L5 / L7 … L10 / L12 / L13b / L16a, d36 J13 (mutant 273); kart: d37 L1 … L10 / L12 / L15 / L16a, d36 J13 (mutant 269); gecikmiş / takvim: d37 L1 / L6 / L7 / L8 / L9 / L11 / L12 / L13c / L15 / L16a, d36 J13 (mutant 274). Mutant 268 (bakım 10 — pay kuyruktan da düşer) S126 kartında ETKİSİZ: O = T kartın tükettiği kalemler kuyrukta zaten 0 |
| Z139 | İkinci ödemede sıra baştan başlar | d37 L3 / L4 / L5 / L7 / L13b (mutant 267) |
| Z140 | Silinen ödeme sayılır / geri yüklenen sayılmaz; S50 payı ödeme sayılmaz | d37 L8 / L9 / L10 |
| Z141 | Kartın tamamen içine aldığı fatura takvimde kalem olur ya da kartın dışındaki fatura takvimden düşer | d37 L1 … (`takvim:fatura` "yok"), L18 (fatura 600 takvimde) |
| Z142 | Vade ↔ belge sırası ödemeyi ayırırken değer uydurulur / ayırmazken susulur | d37 L13 (SUS), L13b / L13c (değer) |
| Z143 | Öbür kalem türlü kartta değer uydurulur (SK-25) | d37 L14 (SUS) |
| Z144 | Yalnız elle kalemli bakiye kadar kart (Y10-3) ya da açık borçtan küçük kart (S120 / S122) bozulur | d37 L17 / L18, d36 J1 … J12b |
| Z145 | Aynı adlı iki carinin ödemesi / faturası karışır | d37 L16a / L16b |

### Senaryolar (bakım 11; elle tablolar — kâhin koşulmadan karar metninden ve §13 / §20 / §22 / §23'ten; betikler `docs/kanit/2026-11-11/kahineski11-arac/yeni-senaryolar11.py`, `d36-guncelle11.py`, adımların yeri `g1-sirala.py`)
- **`d37-c5-s126-faturali-kart`** (bugün 15.04.2026; 355 elle denetim = 344 değer + 9 yok + 2 belirsiz): L1 kararın örneği AYNEN (kart tahsilatı 300 ⇒ F açık 300, X Kalan 300) · L2 ödeme F'yi tam bitirir
  (600 ⇒ F 0, X 300) · L3 aşıp X'e geçer (700 ⇒ F 0, X 200) · L4 kartı kapatır (900 ⇒ 0 / 0) · L5 iki ödeme üst üste 300 + 400 (F 0, X 200) · L6 elle borç faturadan eski (X 0, F 600) · L7 iki fatura + elle
  (F1 400 · X 300 · F2 500, kart 1.200, ödeme 600 ⇒ F1 0, X 100, F2 500) · L8 S50 payı 500 (F 100, X 300) · L9 silme (F 300, X 300) · L10 silme + geri yükleme (F 0, X 300) · L11 ödemesiz (F 600, X 300; gecikmiş
  = taksit 1 300) · L12 yalnız faturalar (F1 100, F2 500 — Y11-7) · L13 SUS (S125 = C; vade sırası F 300 / X 300 ↔ belge X 0 / F 600) · L13b değer (kart tamamen ödenmiş) · L13c değer (vadeli kayıt sırayı
  değiştirmiyor: X 0, F 600) · L14 stok veresiye satışlı kart SUS (SK-25) · L15 borçlu Açılış + fatura (Açılış 0, F 600) · L16a / L16b aynı adlı iki cari · L17 yalnız elle kalemli bakiye kadar kart (bakım 10 —
  X 200, Y 400; değişmedi) · L18 açık borçtan küçük kart (S120 / S122 — X 200, Y 700, F 600 takvimde; değişmedi). Her değer carisinde `acikToplam` = bakiye ve `acikEsitBakiye` (NOT (4)).
- **`d36-c5-s122-kart-odemesi` J13 (bakım 10'un SK-24'ü = kararın örneği AYNEN — karar gereği değişti):** 5 `elleYok` (gecikmiş, kart kalanı, X Kalan, X takvim, F açık) + 1 `elleBelirsiz` ("birden çok
  kalemi tüketti") KALKTI, 15 elle değer EKLENDİ — F açık 300, `takvim:fatura` "yok", X Kalan 300, X takvim / Vade Takip / projeksiyon "yok", gecikmiş 0, açık toplamı 600 = bakiye, kart 900 / 300
  ([300, 0, 0]). Adımlar ve öbür beklentiler (J1 … J12b, J14 … J17b) AYNEN. d36 toplam 371 elle denetim (bakım 10: 362).
- **İlk koşu:** 726 elle denetimin (d37 355 + d36 371) hepsi kâhinle aynı (koşudan sonra değişen elle değer YOK). Elle değerler yazılmadan önce kâhin S126 alanında koşulmadı / çıktısına bakılmadı.

### C10p Mutantlar (bakım 11; `oz-test.py` DEĞERLE — çökmeden, elle tablo kırmızı)
270 S126 B (önce elle borçlar) · 271 yalnız faturanın açığı düşer · 272 yalnız elle kaydın Kalan'ı düşer · 273 faturaya düşen pay bakiyeyi bir kez daha düşürür · 274 kartın içindeki faturanın açığı kuyrukta
da sayılır (gecikmiş / takvim). En yeniden (265), orantılı (266), her ödeme baştan (267) ve kart ödeneni (269) bakım 10 mutantları S126 yolunda da işler ve d37 / d36 J13'te DEĞERLE yakalanır; 268 S126 kartında
etkisiz (C8p Z138). Bakım 6 … 10 mutantları (241–269) aynen yakalanıyor.

### Dil ekleri (/3, bakım 11)
Yeni adım YOK; yeni çıktı anahtarı YOK (S110 alanında kartın tükettiği satış faturasının `takvim:fatura:<ad>`'ı artık yazılır — anahtar biçimi aynı). `belirsiz` kayıtları: "Mevcut Borç kartı <no> carinin bütün açık
borcunu içine aldı ve içinde fatura / elle kayıt dışında kalem var (<kalemler>) — ödemenin sırası kararda yok (S126 'fatura DAHİL') — KULLANICIYA SORULMALI SK-25 (§23 Y11-9)" ve "Mevcut Borç kartı <no> carinin
bütün açık borcunu (fatura dahil — S126) içine aldı ve kartın <P>'si ödendi — … BİLİNEN SINIR (kullanıcı kararı S125 = C) SK-23 (§22 Y10-4, §23 Y11-8)". "birden çok kalemi tüketti" kaydı Taksitler kartında
artık yazılmaz (Tablodan Aktar kartında aynen).

### Eşleme notları (ana oturum için; `kos.mjs` bu bakımda DEĞİŞMEDİ, açılmadı)
- Yeni adım / anahtar yok; d37 bakım 7–10'un adım türleriyle (`cari_ac {acilis}`, `fatura`, `borc {vade}`, `tahsilat`, `stok_satis_hesap`, `kart_ac {mevcut}`, `kart_tahsilat`, `hareket_sil` / `hareket_geri_yukle`
  (`cari` alanıyla — bakım 10 düzeni)).
- **Ana oturuma:** `model.py` değişti — mobil yazma kâhininin `cari_model_sha256`'sı yeniden üretilmeli (o dosya okunmadı); yapım aşaması listesi bu ajanca açılmadı (d37 ve d36 J13'ün yeni değerleri — özellikle
  S110 alanındaki yeni `takvim:fatura` denetimi — listeye yeni kayıt olarak düşebilir; ayrıştırma ana oturumda).

### C12p DENENMEYEN (bakım 11; neden)
- Program koşulmadı (görev). Programın S126 alanındaki gösterimi bilinmiyor.
- SK-25'in öbür kalem türleri (karşılıksız çek / senet kalemi, başka taksit kartının taksiti, taksitli faturanın taksiti) için elle senaryo yazılmadı — kural yolu aynı (`tur_` "o"), yalnız stok veresiye
  satışı (L14) denendi.
- Faturanın satış iadesi / faturaya bağlı tahsilat (kart açıldıktan sonra) ile S126 kartı: bağlar kartın gününden bağımsız önce kapattığından kart açıldığı anda O < T olur (EK-2B 32 / S101 alanı) — bu
  bakımın konusu değil, senaryo yazılmadı. Kart tahsilatının silinmesi (dilde yol yok — bakım 10 C12o aynen); tahsilat tutarının düzeltilmesi (dilde adım yok).
- Aynı caride iki S126 kartı; Ödeme Sözü taşıyan kalem; vade günü / gün dönümü; iki şirket / yedek geri yükleme (kâhinin dilinde şirket yok).
- Y11-7'nin ters okuması (yalnız faturalı kart SUS) koşulmadı — G3'te ayrı sınıf (S126-F) olarak sayıldı.

### C0p Değişen eski beklentiler (G3; bakım 10 (`3aa793fb` ağacı — çalışma dalı ucu) ↔ bakım 11 kâhin çıktısı, `2.5.0`; eski kopyanın 90 elle senaryosu + d37 + rastgele s1 / ux18 tohum 1–10 × 120) — kararla ilgisiz eski beklenti DEĞİŞMEDİ
Eski 47.766 → yeni 48.036 denetim; değişen / kalkan / yeni toplam **270**, hepsi **yeni** (bakım 10'un sustuğu yerde artık değer): S126-alan 258 + S126-F 12; **BEKLENMEYEN 0**, değeri değişen 0, kalkan 0,
yalnız etiketi değişen 0 (dökümü `docs/kanit/2026-11-11/kahineski11-g3-dokum-*.json` — iki saat diliminde bayt bayt aynı; özet `kahineski11-esdeger-cari-*.log`; cari cari sayım `kahineski11-arac/g3-cari.py`).
Sınıf, yeni modelin `son["s122"]` izinden cari cari:
- **d36 (16 yeni, S126-alan):** J13 — kararın örneği (bakım 10'da "birden çok kalemi tüketti" ile susuyordu — SK-24). Öbür J carilerinde fark 0 (S122 alanı — bakım 10 — AYNEN).
- **d37 (254 yeni; dosya yeni, eski kâhinde de koşuldu):** S126-alan 242 — L1 / L2 / L3 / L4 / L5 / L6 / L8 / L9 / L10 / L11 / L13b / L13c / L15 / L16a 16'şar, L7 18 (eski kâhin "birden çok kalemi tüketti" ile
  susuyordu); S126-F 12 — L12 (yalnız faturalar; Y11-7 — ters okuma seçilirse yalnız bu 12 denetim kalkar). Fark 0: L13 (iki kâhinde de susar: "birden çok kalemi tüketti" → S125 = C), L14 (iki kâhinde de
  susar → SK-25), L16b (kartsız), L17 (bakım 10 Y10-3 AYNEN), L18 (S120 / S122 AYNEN).
- **Öbür 89 eski elle senaryo ve 20 rastgele: fark 0** (adımları değişen eski senaryo 0; O = T faturalı Taksitler kartı eski elle senaryolarda yalnız d36 J13'te).
- **Eski ELLE tablolarda değişen beklentiler** (`kahineski11-elle-fark-*.log`; yalnız d36, karar gereği): J13 — 5 `elleYok` + 1 `elleBelirsiz` ("birden çok kalemi tüketti") kalktı, 15 değer eklendi. Öbür 89 dosyanın
  elle tablosu ve bütün dosyaların adımları AYNI.
- `--kural 2.4.9` / 2.4.6 / 2.4.5 / `--legacy`: **444/444 bayt bayt aynı** (90 eski elle + d37 + 20 rastgele × 4 kip); üretici 20/20 aynı dizi.
- **Yeni / değişen elle tablolar ESKİ (bakım 10) kâhinde — beklenen NEDENLE kırmızı (ders 7, 38):** 726 elle denetimin **242**'si (`kahineski11-kirmizi-eski-cari-*.log`; d37 228, d36 14): 240'ı "ANAHTAR YOK"
  (eski kâhin "birden çok kalemi tüketti" ile susuyor), 2'si `belirsiz` kaydında "S125 = C / SK-23" (L13) ve "SK-25" (L14) yok (eski kâhin "birden çok kalemi tüketti" yazıyor); 484'ü iki kâhinde aynı
  (bakiyeler, kart tutarları, L16b, L17, L18, d36'nın öbür carileri).

### Kanıt (bakım 11; iki saat dilimi — UTC ve Europe/Istanbul çıktıları bayt bayt aynı (başlık satırları dışında); kâhin `02517ac5`, temiz ağaç; `docs/kanit/2026-11-11/kahineski11-*`, araçlar ve koşu betiği `kahineski11-arac/`)
cari öz test **5.277/5.277** (`-cari-oz-*`: elle tablolar 91 senaryo, mutantlar 200–274 — 219–274 değerle) · mutasyon taraması **241/241** (`-cari-mutasyon-*`) · eşdeğerlik + G3 **555/555** (`-esdeger-cari-*`) ·
yeni / değişen elle tablo **726/726** (`-elle-yeni-cari-*`: d37 355 + d36 371) · ESKİ kâhinde **242 kırmızı** / 726 (`-kirmizi-eski-cari-*`) · eski elle tablo farkı **90/90** izinli (`-elle-fark-*`) · G1 tarama
**91/91** (`-g1-tara-*`) · mutant ↔ senaryo **42/42** (`-mutant-senaryo-*`) · geniş tarama **2.201/2.201** (`-genis-tarama-*`; bakım 10 ile aynı sayı). **Defter öz testi BAŞARISIZ** (`-defter-oz-*`;
`VARSAYILAN_KURAL` AttributeError) — bakım 9 / 10'daki gibi, TABANDA (`3aa793fb` eski kopyası) da aynı; bu bakım defter kâhinine dokunmadı. Öz test, mutasyon, eşdeğerlik ve geniş tarama `flock -s -n …/olcum.lock`
ile (ders 52). Program açılmadı. Koşu günlükleri `kahineski11-kos-utc.txt` / `-ist.txt` (yük 2,6 / 3,8 — 4 çekirdek).

## 24. 2.5.0 Ç5 bakımı 12 — S128 (bakiye kadar açılan Taksitler kartının içinde fatura / elle borç DIŞINDA kalem de varsa karta gelen ödeme kalemleri TÜRÜNE BAKILMADAN kartın içine alma sırasıyla, eskiden yeniye düşürür) (12.11.2026, `date -u` 04:01; karar 11.11.2026 — ana oturumun özet dosyası; eski kâhinler bakımı 12 — kodu görmeyen AYRI el) — kural seti `2.5.0` = §13 + … + §23 + bu bölüm

Bu bakım KÜÇÜKTÜR: tek kullanıcı kararı (S128 — bakım 11'in SK-25 sorusunun yanıtı); yalnız §23 Y11-9'un SK-25 susmasını (Taksitler'den açılan, açık borca EŞİT (O = T) kart, içinde fatura / elle kayıt dışında
kalem de var) değer alanına çevirir — kâhinin dilinde tek okuma çıkan türlerde. S110 (§20), S120 (§21), S122 (§22), S126 (§23 Y11-1 … Y11-12), S2, S50, S99, S101 ve §13–§23'ün öbür kuralları DEĞİŞMEZ;
tek kalem içeren kartta C13.4 (7) AYNEN. `--kural 2.4.9` (ve 2.4.6 / 2.4.5 / `--legacy`) AYNEN. Defter kâhini (`test/bagimsiz/defter/`) DEĞİŞMEZ (Mevcut Borç kartı maddesizdir — C13.2 / kitap H-02).
**Bu bölümün ilk commit'i yalnız YORUMDUR (ders 40 — önce kural, sonra kod); senaryo / mutant / G3 sayıları kod ve kanıt commit'lerinde eklenir.**

### C00q Temiz oda (bakım 12)
- **Girdi (AYNEN; ana oturumun özet dosyası `scratchpad/kahin-eski12-kararlar.md` — "programın hesap / görünüm davranışı hakkında hiçbir bilgi içermez"):**
  - SORU (kullanıcıya gösterilen metin — AYNEN): "S128 — kartın içinde fatura ve elle borç dışında kalem varsa (para kuralı; uç durum). Taksitler'den açılan kart carinin bütün açık borcuna eşit ve içine
    stok veresiye satışı gibi başka türden bir kalem de girmiş. Karta gelen ödeme hangi kalemi düşürsün? Örnek: 01.03 stok veresiye satışı S 400, 02.03 elle borç X 300, 15.03 kart 700, 10.04 karta 300
    ödeme. — A (öneri): türüne bakılmadan eskiden yeniye — S açığı 100, X Kalan 300. S122 ve S126'da verilen kararın devamı. — B: önce fatura ve elle borçlar — X Kalan 0, S açığı 400. — C: uç durum böyle
    kalsın (BİLİNEN SINIR olarak yazılır; kâhin bu durumda susar). Bakiye ve kart kalanı üç seçenekte de 400."
  - Aynı iletide bilgi olarak gösterilen (AYNEN; "kullanıcı itiraz etmedi → kalır"): "bakım 11'in Y11-7'si — S126 kuralı içinde yalnız faturalar olan (elle borç olmayan) açık borca eşit karta da uygulanır
    (eskiden yeniye)."
  - KARAR (kullanıcı 11.11.2026, AYNEN: "ikiside a"): "S128 = A (PARA KURALI): Taksitler'den açılan kart carinin bütün açık borcuna eşitse ve içine fatura / elle borç dışında bir kalem de girdiyse (stok
    veresiye satışı, karşılıksız kalemi, başka kartın ya da taksitli faturanın taksiti) karta gelen ödeme kalemleri TÜRÜNE BAKILMADAN, kartın içine alma sırasıyla ESKİDEN YENİYE düşürür. Örnek: 01.03 stok
    veresiye satışı S 400 · 02.03 elle borç X 300 · 15.03 kart 700 · 10.04 karta 300 ödeme ⇒ S açığı 100, X Kalan 300 (bakiye 400, kart kalanı 400)."
  - NOT (ana oturum, AYNEN): "(1) karar yalnız "açık borca EŞİT kart, içinde fatura / elle borç dışında kalem de var" durumunu yanıtlar; S110, S120, S122, S126, S2, S50, S99, S101 kararlarının ve bakım 11'in
    kurallarının YERİNE geçmez. (2) Bakım 11'in Y11-7'si (yalnız faturalı kart) KALIR — artık 'baş mimarın değerlendirmesine' notu kalkar, kullanıcıya gösterildi. (3) "Eskiden yeniye"nin vade ↔ belge sırası
    ayrışması (S125 = C BİLİNEN SINIR, SK-23) AYNEN: iki sıra farklı pay veriyorsa SUS. (4) Kararın saydığı dört tür (stok veresiye satışı, karşılıksız kalemi, başka kartın taksiti, taksitli faturanın
    taksiti) için: kararın metninden ve kâhinin yürürlükteki kurallarından TEK okuma çıkıyorsa değer yaz (gerekçesiyle); bir türde "kalemin açığı / kalanı" kavramı kâhinde tanımlı değilse ya da iki okuma
    varsa o alt durumda SUS ve "KULLANICIYA SORULMALI" yaz (iki seçenek + öneri; uç durumsa üçüncü seçenek "Uç durum böyle kalsın (BİLİNEN SINIR)"). (5) "Karta gelen ödeme"nin iki yolu için bakım 10'un Y10-2
    okuması, silme / geri yükleme için Y10-5 geçerli sayılır. (6) Cari "açık toplamı = bakiye" değişmezi her değer carisinde elle tabloda denetlenir. Kendi yorumunla kesinleştirme."
- **Birlikte okunan (kâhinin kendi belgesi):** bu dosyanın K6.5 (a), §13 C13.4 (1)–(11) ve C13.5, §19 (Y7-3, SK-18, C19.3), §20 (Y8-4), §22 (Y10-1 … Y10-7, C22.1 … C22.4), §23 (bütünü — Y11-1 … Y11-12,
  SK-25, C23.1 … C23.4, C8p, C0p); `model.py` kart tüketimi (`_tyk`), elle Mevcut Borç kartının kabulü (`kart_ac`, `_g2b_okumalar`, `kos()`'un SK-18 iki dünyası), dağılım (`_s122_dagit`), defter kalanı
  (`_alacak_govde250`), kart ödeneni (`kart_odenen`, `kontrol` kart kalemleri), açık toplamı (`kontrol_acik_toplam`), görünüm (`_cari_kalemleri`, `_belirsiz_uyeler`); d37 elle senaryosu ve onu üreten
  `docs/kanit/2026-11-11/kahineski11-arac/yeni-senaryolar11.py`. Okunan / okunmayan dosyaların tam listesi (satır aralıklarıyla) ajan raporunda.
- **Okunmayan:** `server/**`, `client/**`, `bulut/**`, `packaging/**`, `tools/**` (yalnız `kanit.mjs` çalıştırılır), `docs/erp/C5-ACILIS-TASARIM.md`, `docs/erp/C5B-TYK-TASARIM.md`, `docs/devir/**`,
  `docs/2.5.0-IS-LISTESI*.md` (hiçbir sürümü), `test/bagimsiz/cari/YAPIM-ASAMASI.json`, `kos.mjs`, iki kâhin klasörü dışındaki `test/**`, başka ajanların `docs/kanit/**` dosyaları (yalnız
  `kahineski11-arac/` araçları), git farkı / geçmiş içeriği. Program koşulmadı; programın davranışı aranmadı. CLAUDE.md "Açık iş"teki program durumu kural / beklenti kaynağı sayılmadı.

### Kâhinin BUGÜNKÜ (bakım 11, `02517ac5` + çalışma dalı `bb05ae9b`) okuması — S128 alanında (açıkça)
Bakım 11 kâhini S128'in hiçbir seçeneğini DEĞER olarak yazmıyordu: Taksitler'den açılan kart açıldığı anda carinin açık borcuna EŞİT (O = T) ve ≥ 2 kalem tüketti, tükettiği kalemlerden en az biri ne
taksitsiz satış faturası ne elle kayıt ise (`tur_` "o": KS7.1 stok veresiye satışı, C14.3 karşılıksız kalemi, başka taksit kartının taksiti, taksitli faturanın (S99) taksiti) cari C13.4 (11) düzeninde —
kartın ödenen kısmından BAĞIMSIZ (ödeme 0 iken de) — SUSUYORDU (`belirsiz` "… içinde fatura / elle kayıt dışında kalem var (…) — ödemenin sırası kararda yok (S126 'fatura DAHİL') — KULLANICIYA SORULMALI
SK-25 (§23 Y11-9)"; yazılanlar yalnız bakiye ve kart tutarı). Kararın örneği d37 L14'tür (01.03 stok veresiye satışı S 400 · 02.03 X 300 · 15.03 kart 700 · 10.04 kart tahsilatı 300 — aynı tarih ve
tutarlarla; bakım 11'in SK-25'i). Seçenek B'nin ("önce fatura ve elle") de, C'nin (susma) de değeri yoktu; kâhinin davranışı C ile aynıydı.

### Yorumlar (ders 40 — karardan; kod yazılmadan ÖNCE; baş mimar kullanıcıya gösterir)
- **Y12-1 — alan:** S128 şu kartta uygulanır: Taksitler'den açılan Mevcut Borç kartı (satışla açılan kart değil — Y7-2; Tablodan Aktar kartı değil — Y8-6), açıldığı anda O = T (S110 / S120 alanı değil —
  Y8-1 / Y9-3; S101'in O < T'si değil — EK-2B 32), M1e ile İKİ ya da daha çok kalem tüketmiş ve tükettiği kalemlerden en az biri fatura / elle kayıt DIŞINDA (kararın saydığı dört tür). İçinde fatura / elle
  kayıt da olabilir, olmayabilir (Y12-7). Hepsi elle → §22 Y10-3 AYNEN; elle + fatura / yalnız fatura → §23 Y11-2 / Y11-7 AYNEN.
- **Y12-2 — kural ("TÜRÜNE BAKILMADAN, kartın içine alma sırasıyla, ESKİDEN YENİYE"):** kartın ödenen kısmı P (Y10-1'in P'si: kart taksitlerinin kapanan toplamı, S101'in avansla ödenmiş saydığı kısım
  hariç) kartın tükettiği kalemlere kalem türüne bakmadan kartın İÇİNE ALMA SIRASIYLA (M1e'nin sırası = S2: vade → belge → yazım; stok veresiye satışında ve karşılıksız kaleminde vade = belge günü —
  C13.4 (1), C14.3), eskiden yeniye, birikimli dağılır (Y10-1 / Y11-2 ile aynı yol). Her kalemin defter kalanı (K6.5 (a); C13.4 (7)) = kuyruk kalanı + tüketilen − o kaleme düşen pay. Kararın örneği AYNEN:
  S tüketilen 400, X tüketilen 300; P = 300 ⇒ S 0 + 400 − 300 = 100 (S'nin açığı), X 0 + 300 − 0 = 300 (Kalan). Bakiye (400), kart kalanı (700 − 300 = 400) / ödeneni, gecikmiş (C13.5 — kuyruk kalanı),
  takvim / Vade Takip / projeksiyon (kuyruk kalanı — Y8-4) DAĞILIMDAN BAĞIMSIZ (kararın parantezi "bakiye 400, kart kalanı 400").
- **Y12-3 — kalemin KENDİ değeri (NOT (4)) — tür tür:**
  - (i) **stok veresiye satışı (KS7.1):** kâhinin dilinde bu kalemin açık / Kalan çıktı anahtarı YOK (§23 Y11-9'un parantezi; C16.1 onu yalnız görünüm toplamında sayar). Kararın "S açığı 100"ü kâhinde
    YAZILMAZ (kâhinin sınırı — kural sorusu değil). Kalemin karttaki kısmı (tüketilen) belli olduğundan sıradaki öbür kalemlerin payı TEK okumayla çıkar → **DEĞER** (elle Kalan, fatura açığı, kart, gecikmiş,
    takvim).
  - (ii) **karşılıksız kalemi (C14.3 — carisiz evrakın karşılıksızında seçilen carinin borç kalemi):** (i) ile aynı — kâhinde kalemin açık anahtarı yok; öbür kalemlerin payı tek okuma → **DEĞER**.
    (`acikToplam` / `acikEsitBakiye` bu caride C14.3 gereği zaten yazılmaz — değişmedi.)
  - (iii) **başka taksit kartının taksiti** ve (iv) **taksitli faturanın (S99) taksiti:** iki ayrı kâhin sınırı üst üste:
    (a) **Kartın kabulü zaten SK-18'dir (§19 Y7-3 — AÇIK soru, KULLANICIYA SORULMALI):** O = T kart başka bir kartın / taksitli faturanın açık taksitlerini de tüketiyorsa bakiye okuması ("bakiye − zaten
    taksitlendirilmiş kısım" ≥ kart tutarı) reddeder, kalem okuması (açık borç kalemleri kartı karşılıyor) kabul eder → kâhin kartın kabul / yok dünyalarında farklı çıkan her denetimi yazmaz (kos() SK-18).
    SK-18 A seçilirse (sınır bakiye) böyle bir kart zaten açılamaz ve S128'in (iii) / (iv) kolu hiç doğmaz.
    (b) SK-18 B seçilse bile kalemin KENDİ gösterimi iki okumalı: (iii)'te içine alınan taksitin kendi kartının ödeneni / kalanı (`kart:<öbür kart>:…`) — K6.5 (a)'nın karşılığıyla "kart, öbür kartın taksitini
    taşır; o taksit yeni karta gelen ödeme ona ulaşınca ödenmiş görünür" ↔ bugünkü tüketim düzeni (tüketilen taksit tüketildiği gün kapanmış görünür; yeni karta gelen ödeme onu değiştirmez); (iv)'te taksitli
    faturanın açığı — C13.4 (7)'nin genel cümlesi ("faturanın açığı kartın kapsadığı kısmı İÇERİR" → kuyruk kalanı + tüketilen − pay) ↔ aynı maddenin taksitli cümlesi ("kendi kartının ödenmemiş taksitleri;
    kartına ödeme ulaşmadıysa tutarın tamamı"). Karar ikisini ayırmıyor → **SUS** (C13.4 (11) düzeni; yazılanlar yalnız bakiye — SK-18'in iki dünyasında aynı olanlar), neden "… KULLANICIYA SORULMALI
    SK-26 (§24 Y12-3)" (SK-18 ile birlikte). Sıradaki öbür kalemlerin payı (iii) / (iv)'te de tek okumadır; ama SK-18 o carinin denetimlerini zaten iki dünyaya bağlıyor — kâhin parçalı yazmaz.
- **Y12-4 — "karta gelen ödeme"nin iki yolu (NOT (5)):** Y10-2 AYNEN — P kaynağına bakmaz: kart tahsilatı ve kart seçilmeden alınan tahsilatın (ve öbür bağsız kapatıcıların) S50 ile taksite düşen payı AYNI
  P'ye girer.
- **Y12-5 — silme / geri yükleme (NOT (5)):** Y10-5 AYNEN — dağılım yalnız P'nin TOPLAMINA bağlıdır (iki ödeme üst üste = toplamları tek ödeme); silinen tahsilat P'ye girmez, geri yüklenen kendi tarihinde girer.
- **Y12-6 — P = 0:** Y11-3 AYNEN (dağılım sorusu doğmuyor): her tüketilen kalemin defter kalanı = kuyruk kalanı + tüketilen.
- **Y12-7 — içinde fatura / elle kayıt OLMAYAN kart (yalnız (i) / (ii) türleri, ≥ 2 kalem):** kararın işleyen cümlesi ("türüne bakılmadan … eskiden yeniye") bu kartı da kapsar; kapsamasa bile kâhinin yazdığı
  hiçbir değer dağılıma bağlı değil (kalemlerin kendi açığı kâhinde yazılmaz — Y12-3 (i) / (ii); bakiye, kart, gecikmiş, takvim dağılımdan bağımsız — Y12-2) → iki okumada da AYNI değer → **DEĞER** (tek
  okuma). Bakım 11'e kadar SK-25 ile susuyordu.
- **Y12-8 — S125 (= C) ile çakışan alt durum — SUS (BİLİNEN SINIR), Y10-4 / Y11-8 AYNEN (NOT (3)):** vadeli elle kayıt iki sıranın kalemleri FARKLI dizmesine yol açıyorsa (stok veresiye satışı ve
  karşılıksız kaleminin vadesi belge günüdür — onlar sırayı tek başına ayırmaz) ödeme vade sırasıyla başka, belge tarihi sırasıyla başka kalemden düşer → SUS, neden "… BİLİNEN SINIR (kullanıcı kararı
  S125 = C) SK-23". Örnek: 01.03 X 300 (vade 30.03) · 05.03 S 400 · 15.03 kart 700 · 10.04 kart tahsilatı 300 ⇒ vade sırası S → X (S açığı 100, X Kalan 300) / belge sırası X → S (X Kalan 0, S açığı 400)
  (bakiye 400, kart kalanı 400 ikisinde aynı). İki sıra aynı payı veriyorsa (kart tamamen ödenmiş; ya da vadeli kayıt sırayı değiştirmiyor) DEĞER.
- **Y12-9 — görünüm (Y8-4 / C20.3 / Y11-10 AYNEN, S110 alanının kuralları):** S128 kartlı caride elle Kalan / fatura açığı defter kalanıdır (Y12-2); takvim / Vade Takip / projeksiyon tutarı kuyruk kalanıdır
  (kartın tamamen içine aldığı kalem takvimde kalem değil — "yok"); sayaç ve görünüm toplamı yazılmaz (Y8-4).
- **Y12-10 — NOT (6) "açık toplamı = bakiye":** elle tabloda her değer carisinde Σ (fatura açığı + elle Kalan + stok veresiye satışının / karşılıksız kaleminin defter kalanı) = bakiye betikte DENETLENİR (kararın
  örneğinde 100 + 300 = 400). Kâhinin `acikToplam` anahtarı ise KS8.1 tanımıyla (`kontrol_acik_toplam`) yalnız fatura açığı + elle Kalan toplar — stok veresiye satışı bu toplamda YOK (değişmedi; emsal d30 Q1:
  stok veresiyeli caride `acikEsitBakiye` false) → stoklu caride `acikToplam` = Σ fatura açığı + Σ elle Kalan, `acikEsitBakiye` = (o toplam = bakiye) — stok kaleminin açığı 0 değilse false. Karşılıksız
  kalemli caride iki anahtar yazılmaz (C14.3 aynen).
- **Y12-11 — bakım 11'in Y11-7'si (NOT (2)):** yalnız faturalı bakiye kadar kart (S126-F) DEĞER — "baş mimarın değerlendirmesine" notu KALKTI (kullanıcıya gösterildi, itiraz etmedi). Ters okuma koşulu
  (§23 Y11-7'nin son cümlesi) düştü; G3'teki "S126-F" sınıfı artık S126-alanın parçasıdır (sayılır, ayrı tutulmaz).
- **Y12-12 — DEĞİŞMEYEN:** S120 / S122 kartı (O > T — öbür türdeki kalem kartın DIŞINDA kalır, kuyruk kalanıyla); Y9-2 "kendi" kartı (tek kalem); satışla açılan kart (Y7-2); Tablodan Aktar kartı (Y8-6 —
  çok kalem tükettiyse "birden çok kalemi tüketti" ile AYNEN susar); S101 (O < T); taksitli fatura (S99) ve iadesi (C13.4 (11)); karşı yönlü kalemli kartlı cari (C16.2); SK-18 (§19); SK-20 / SK-22 / SK-23
  (S123 / S124 / S125 = C); S2 / S50 sırası; gecikmiş C13.5 / C16.4; hepsi elle (Y10-3) ve fatura + elle / yalnız fatura (Y11-2 / Y11-7) kartları.

### SK-25'in ve Y11-9'un durumları bu kararla (açıkça)
| Durum (Taksitler kartı, O = T, ≥ 2 kalem tüketti, en az biri fatura / elle DIŞINDA) | Bakım 11 | Bakım 12 (S128 A) |
|---|---|---|
| içinde stok veresiye satışı (fatura / elle ile ya da onlarsız) | SUS (SK-25) | **DEĞER** (Y12-2 / Y12-3 (i) / Y12-7) — Y12-8 alt durumu dışında; stok kaleminin kendi açığı kâhinde yazılmaz |
| içinde karşılıksız kalemi | SUS (SK-25) | **DEĞER** (Y12-3 (ii)) — aynı; `acikToplam` yazılmaz (C14.3) |
| içinde başka taksit kartının taksiti | SUS (SK-25; kartın kabulü ayrıca SK-18) | **SUS** — SK-18 (açık) + KULLANICIYA SORULMALI **SK-26** (Y12-3 (iii)) |
| içinde taksitli faturanın taksiti | SUS (SK-25; kartın kabulü ayrıca SK-18) | **SUS** — SK-18 (açık) + KULLANICIYA SORULMALI **SK-26** (Y12-3 (iv)) |
| vadeli elle kayıt ödemeyi iki sırada farklı kaleme düşürüyor | SUS (SK-25) | **SUS** — BİLİNEN SINIR (S125 = C) SK-23 (Y12-8) |
| yalnız faturalar (Y11-7) | DEĞER (baş mimarın değerlendirmesine) | DEĞER — not kalktı (Y12-11) |

### KULLANICIYA SORULMALI (bakım 12; kâhin bu durumda SUSAR — ders 43, SORU DÜZENİ; UÇ DURUM; yalnız SK-18 = B seçilirse anlamlı)
- **SK-26 (bakiye kadar açılan Taksitler kartı carinin BAŞKA bir taksit kartının ya da taksitli faturasının açık taksitlerini de içine aldı — karta gelen ödeme o taksite düşünce eski kart / taksitli fatura ne
  gösterir):** önce SK-18 (§19) gelir — bu kart "taksitlendirilebilecek borç" bakiye okumasıyla açılamaz; SK-18 A (öneri) seçilirse SK-26 doğmaz. SK-18 B seçilirse örnek: 01.03 taksitli fatura T 400 (2 taksit:
  01.03, 01.04 — 200'er) · 02.03 elle borç X 300 · 15.03 kart 700 (kartta T#1 200 + X 300 + T#2 200 — S2 sırası) · 10.04 karta 300 ödeme ⇒ S128 A ile T#1'e 200, X'e 100: **X Kalan 200** (tek okuma), bakiye 400,
  kart kalanı 400. Değişen yalnız T'nin açığı: **A (öneri — K6.5 (a) / C13.4 (7)'nin genel cümlesi: faturanın açığı kartın kapsadığı kısmı içerir, ödeme ulaşınca düşer):** T açığı 200 (T#1 0 + T#2 200) / **B (taksitli
  cümlesi: kendi kartına ödeme ulaşmadı → tutarın tamamı):** T açığı 400 / **C:** uç durum böyle kalsın (BİLİNEN SINIR). (Kâhinin bugünkü tüketim düzeni — tüketilen taksit kuyrukta 0 — T açığına 0 verirdi; kararın
  hiçbir cümlesine dayanmıyor, seçenek sayılmadı.) Başka taksit kartının taksitinde aynı soru o kartın ödeneni için: örnek 10.02 Yeni Borç kartı A 400 (2 taksit: 01.03, 01.04) · 02.03 X 300 · 15.03 kart B 700 · 10.04 B'ye
  300 ⇒ X Kalan 200; **A (öneri):** A'nın ödeneni 200 (ödeme A#1'e ulaştı) / **B:** A'nın ödeneni 400 (B'nin tüketimi A'nın taksitlerini tüketildiği gün kapatır — bugünkü düzen) / **C:** uç durum böyle kalsın.

### Kurallar (kod commit'i; yorumların `model.py`'deki karşılığı)
- **C24.1 (Y12-1 / Y12-3 / Y12-7) `_alacak_govde250`:** `ot_` kartının (Taksitler kartı, O = T, ≥ 2 kalem) "o" türlü kalemleri `o_tur` ile ayrılır: "stok" (`kapaticilar` — KS7.1 stok veresiye satışı), "kars"
  (C14.3 karşılıksız kalemi), "taksitli" (S99 taksitli faturanın taksiti — kalemin kartı `fatura:<ad>`), "kart" (başka taksit kartının taksiti). `ot_128` = en az bir "o" ve hepsi "stok" / "kars" (fatura / elle
  kayıt olsun olmasın) → S128 yolu; "taksitli" / "kart" varsa neden "… KULLANICIYA SORULMALI SK-26 (§24; kartın kabulü ayrıca SK-18)" (C13.4 (11) düzeni; SK-25 nedeninin YERİNE — susma aynen).
- **C24.2 (Y12-2 / Y12-4 / Y12-5 / Y12-6):** `ot_128` kartı C22.1 / C23.2'nin yoluna girer: P = Σ taksit ödeneni − S101 önceden; `_s122_dagit(tk, tk'nin sırası, P)` (türüne bakmadan — S2) → her kalemin
  `acik` (faturada belge açığı, elle kayıtta Kalan; stok kaleminde iç değer — çıktısı yok) = kuyruk kalanı + tüketilen − pay; P = 0 iken pay 0. Görünüm S110 alanının kurallarıyla (`s110 = True` — Y12-9).
- **C24.3 (Y12-8):** belge tarihi sırasıyla (`(d, s)`) dağıtım başka pay veriyorsa SUS — neden "… carinin bütün açık borcunu (fatura / elle kayıt dışında kalem dahil — S128) içine aldı ve kartın <P>'si
  ödendi — … BİLİNEN SINIR (kullanıcı kararı S125 = C) SK-23 (§22 Y10-4, §24 Y12-8)".
- **C24.4 (Y12-10):** `kontrol_acik_toplam` DEĞİŞMEDİ (KS8.1 — stok veresiyesi toplamda yok; karşılıksız kalemli cari yazılmaz). NOT (6) elle tablo betiğinde assert edilir (`cari(…, defter=…)`).
- **C24.5 (Y12-11):** kod değişikliği yok (Y11-7 zaten değerdi; yalnız yorum notu ve G3 sınıflaması).
- İz: `son["s122"]` kart → … | "s128" (+ "-odemeli") | "sk26" | "sus"; `son["s128_opay"]` (öbür türe düşen pay — yalnız mutant 278). Sonucu değiştirmez. "sk25" izi artık üretilmez.
- `--kural 2.4.9` / 2.4.6 / 2.4.5 / `--legacy`: hiçbir yol değişmedi (yeni dallar `_alacak_govde250` içinde — yalnız `2.5.0` — ya da mutant).

### C8q Nasıl bozulur? (bakım 12 — kod commit'inde, senaryolarla birlikte yazıldı)
| # | Bozulma | Senaryo |
|---|---|---|
| Z146 | Ödeme önce fatura ve elle borçlara düşer (S128 B) | d38 M1 / M2 / M3 / M5 / M7 / M8 / M9 / M10 / M12 / M17a, d37 L14 (mutant 275) |
| Z147 | Ödeme en yeniden düşer | d38 M1 / M2 / M3 / M5 / M6 / M7 / M8 / M9 / M10 / M12 / M17a, d37 L14 (mutant 265) |
| Z148 | Ödeme orantılı dağılır | aynı (mutant 266) |
| Z149 | Ödeme yalnız fatura / elle kalemleri düşürür (öbür tür atlanır) | d38 M1 / M2 / M3 / M5 / M7 / M8 / M9 / M10 / M12 / M17a, d37 L14 (mutant 276) |
| Z150 | Ödeme yalnız öbür türleri düşürür | d38 M3 / M4 / M5 / M6 / M7 / M8 / M10 / M16b (mutant 277) |
| Z151 | Öbür türe düşen pay bakiyeyi / kart kalanını / gecikmişi de değiştirir ("bakiye 400, kart kalanı 400") | bakiye: d38 M1 / M2 / M3 / M4 / M5 / M7 / M8 / M9 / M10 / M12 / M13 / M16b / M17a, d37 L14 (mutant 278); kart: d38 M1 … M10 / M12 / M13 / M16b / M17a / M18 / M19, d37 L14 (mutant 269); gecikmiş / takvim: d38 M1 / M6 / M9 / M11 / M12 / M13 / M17a, d37 L14 (mutant 279). Mutant 268 S128 kartında ETKİSİZ (O = T kartın tükettiği kalemler kuyrukta zaten 0 — Z138 ile aynı) |
| Z152 | İkinci ödemede sıra baştan başlar | d38 M3 / M4 / M5 / M7 / M8 / M10 / M16b (mutant 267) |
| Z153 | Silinen ödeme sayılır / geri yüklenen sayılmaz; S50 payı ödeme sayılmaz | d38 M8 / M9 / M10 |
| Z154 | Vade ↔ belge sırası ödemeyi ayırırken değer uydurulur / ayırmazken susulur | d38 M16 (SUS), M16b (değer) |
| Z155 | Başka kartın / taksitli faturanın taksitini içine alan kartta değer uydurulur (SK-26) ya da SK-18 iki dünyası bozulur | d38 M14 / M15 (SUS) |
| Z156 | Karşılıksız kalemli caride `acikToplam` yazılır (C14.3) ya da kalem sırası türüne göre değişir | d38 M12 |
| Z157 | Yalnız faturalı / fatura + elle / açık borçtan küçük kart (S126 / S120 / S122) bozulur | d38 M18 / M19, d37 L1 … L13c / L15 … L18 |
| Z158 | Aynı adlı iki carinin ödemesi / stok kalemi karışır | d38 M17a / M17b |

### Senaryolar (bakım 12; elle tablolar — kâhin koşulmadan karar metninden ve §13 / §19 / §20 / §22 / §23 / §24'ten; betikler `docs/kanit/2026-11-11/kahineski12-arac/yeni-senaryolar12.py`, `d37-guncelle12.py`, adımların yeri `g1-sirala.py`)
- **`d38-c5-s128-ozge-kalemli-kart`** (bugün 15.04.2026; 294 elle denetim = 271 değer + 18 yok + 5 belirsiz; 700'lük kart 2 × 350 — 01.04 / 01.05): M1 kararın örneği AYNEN (kart tahsilatı 300 ⇒ X Kalan 300;
  bakiye 400; kart 700 / 300 ([300, 0]) — kart kalanı 400; gecikmiş 50 — taksit 1'in kalanı) · M2 ödeme S'yi tam bitirir (400 ⇒ X 300) · M3 aşıp X'e geçer (500 ⇒ X 200) · M4 kartı kapatır (700 ⇒ X 0) · M5 iki
  ödeme üst üste 200 + 300 (X 200) · M6 elle borç stok satışından eski (X 0) · M7 stok + fatura + elle (S 400 · F 600 · X 300, kart 1.300, ödeme 700 ⇒ F açık 300, X 300) · M8 S50 payı 500 (X 200) · M9 silme
  (X 300) · M10 silme + geri yükleme (X 100) · M11 ödemesiz (X 300; gecikmiş 350) · M12 karşılıksız kalemi + elle (X 300; `acikToplam` yazılmaz) · M13 yalnız iki stok satışı (bakiye 400, gecikmiş 50 — Y12-7) ·
  M14 başka kartın taksiti SUS (SK-18 + SK-26; yazılan bakiye 400 ve öbür kartın var / tutar / türü) · M15 taksitli faturanın taksiti SUS (SK-18 + SK-26; bakiye 400) · M16 SUS (S125 = C; vade sırası X 300 ↔
  belge X 0) · M16b değer (kart tamamen ödenmiş: X 0) · M17a / M17b aynı adlı iki cari (M17b kartsız stok satışı: bakiye 300, gecikmiş 300) · M18 yalnız fatura + elle (S126 — F 300, X 300; değişmedi) ·
  M19 açık borçtan küçük kart (S120 / S122 — stok kartın dışında: X 200, Y 300, gecikmiş 500; değişmedi). Stoklu her değer carisinde `acikToplam` = Σ fatura açığı + Σ elle Kalan, `acikEsitBakiye` = (toplam
  = bakiye) — stok kaleminin açığı 0 değilse false (Y12-10); NOT (6)'nın tam değişmezi (stok kaleminin defter kalanı dahil = bakiye) betikte assert edildi.
- **`d37-c5-s126-faturali-kart` L14 (bakım 11'in SK-25'i = kararın örneği AYNEN — karar gereği değişti):** 4 `elleYok` (gecikmiş, kart kalanı, X Kalan, X takvim) + 1 `elleBelirsiz` (SK-25) KALKTI, 12 elle değer
  EKLENDİ — X Kalan 300, X takvim / Vade Takip / projeksiyon "yok", gecikmiş 50, `acikToplam` 300, `acikEsitBakiye` false, kart 700 / 300 ([300, 0]) / kalan 400, mevcut borç kartı. Açıklamada L12'nin "baş
  mimarın değerlendirmesine" notu ve L14'ün "SUS — SK-25"i güncellendi (Y12-11). Adımlar ve öbür beklentiler (L1 … L13c, L15 … L18) AYNEN. d37 toplam 362 elle denetim (bakım 11: 355).
- **İlk koşu:** 656 elle denetimin (d38 294 + d37 362) hepsi kâhinle aynı (koşudan sonra değişen elle değer YOK). Elle değerler yazılmadan önce kâhin S128 alanında koşulmadı / çıktısına bakılmadı (M14 / M15'in
  SK-18 iki dünyası da kodun okunmasından — `kart_ac` / `_g2b_okumalar` / `kos()` — elle çıkarıldı, koşulmadan).

### C10q Mutantlar (bakım 12; `oz-test.py` DEĞERLE — çökmeden, elle tablo kırmızı)
275 S128 B (önce fatura ve elle) · 276 yalnız fatura / elle kalemleri düşer · 277 yalnız öbür türler düşer · 278 öbür türe düşen pay bakiyeyi bir kez daha düşürür · 279 öbür türün defter kalanı kuyrukta da
sayılır (gecikmiş / takvim). En yeniden (265), orantılı (266), her ödeme baştan (267) ve kart ödeneni (269) bakım 10 mutantları S128 yolunda da işler ve d38 / d37 L14'te DEĞERLE yakalanır; 268 S128 kartında
etkisiz (C8q Z151). Bakım 6 … 11 mutantları (241–274) aynen yakalanıyor.

### Dil ekleri (/3, bakım 12)
Yeni adım YOK; yeni çıktı anahtarı YOK. `belirsiz` kayıtları: "Mevcut Borç kartı <no> carinin bütün açık borcunu içine aldı ve içinde başka taksit kartının / taksitli faturanın taksiti var (<kalemler>) — o
kalemin kendi kartının ödeneni / faturanın açığı kararda yok (S128 'türüne bakılmadan' — §24 Y12-3) — KULLANICIYA SORULMALI SK-26 (§24; kartın kabulü ayrıca SK-18)" ve "Mevcut Borç kartı <no> carinin bütün açık
borcunu (fatura / elle kayıt dışında kalem dahil — S128) içine aldı ve kartın <P>'si ödendi — … BİLİNEN SINIR (kullanıcı kararı S125 = C) SK-23 (§22 Y10-4, §24 Y12-8)". SK-25 kaydı artık yazılmaz.

### Eşleme notları (ana oturum için; `kos.mjs` bu bakımda DEĞİŞMEDİ, açılmadı)
- Yeni adım / anahtar yok; d38 bakım 7–11'in adım türleriyle (`cari_ac`, `fatura {taksit}`, `borc {vade}`, `stok_satis_hesap`, `evrak {cari: null}`, `karsiliksiz {cari}`, `tahsilat`, `kart_ac {mevcut}` —
  M14'te `mevcut: false` (Yeni Borç kartı) da, `kart_tahsilat`, `hareket_sil` / `hareket_geri_yukle` (`cari` alanıyla — bakım 10 düzeni)).
- **Ana oturuma:** `model.py` değişti — mobil yazma kâhininin `cari_model_sha256`'sı yeniden üretilmeli (o dosya okunmadı); yapım aşaması listesi bu ajanca açılmadı (d38 ve d37 L14'ün yeni değerleri listeye
  yeni kayıt olarak düşebilir; ayrıştırma ana oturumda).

### C12q DENENMEYEN (bakım 12; neden)
- Program koşulmadı (görev). Programın S128 alanındaki gösterimi bilinmiyor (stok veresiye satışının "açığı" programda bir sütunda görünüyorsa kâhin onu yazmıyor — Y12-3 (i)).
- Stok veresiye satışının / karşılıksız kaleminin kendi açığı (kâhinde anahtar yok); stok satışının silinmesi / iadesi kart açıldıktan sonra; karşılıksız kalemin geri alınması.
- SK-26'nın değer okumaları (SK-18 ve SK-26 yanıtı gelmeden kurulmaz); kart tahsilatıyla M14 / M15 (SK-18'in "kart yok" dünyasında karta tahsilat adımı kurulamıyor — bağsız tahsilatla denendi).
- Tahsilat tutarının düzeltilmesi (dilde adım yok); kart tahsilatının silinmesi (dilde yol yok — bakım 10 C12o aynen).
- Aynı caride iki S128 kartı; Ödeme Sözü taşıyan kalem; vade günü / gün dönümü; iki şirket / yedek geri yükleme (kâhinin dilinde şirket yok).

### C0q Değişen eski beklentiler (G3; bakım 11 (`bb05ae9b` ağacı — çalışma dalı ucu) ↔ bakım 12 kâhin çıktısı, `2.5.0`; eski kopyanın 91 elle senaryosu + d38 + rastgele s1 / ux18 tohum 1–10 × 120) — kararla ilgisiz eski beklenti DEĞİŞMEDİ
Eski 48.286 → yeni 48.488 denetim; değişen / kalkan / yeni toplam **202**, hepsi **yeni** (bakım 11'in SK-25 ile sustuğu yerde artık değer): S128-alan 202; **BEKLENMEYEN 0**, değeri değişen 0, kalkan 0, yalnız etiketi
değişen 0, S128-genel 0 (dökümü `docs/kanit/2026-11-11/kahineski12-g3-dokum-*.json` — iki saat diliminde bayt bayt aynı; özet `kahineski12-esdeger-cari-*.log`; cari cari sayım `kahineski12-arac/g3-cari.py`). Sınıf, yeni
modelin `son["s122"]` izinden cari cari:
- **d37 (13 yeni, S128-alan):** L14 — kararın örneği (bakım 11'de SK-25 ile susuyordu; 12 elle değer + X'in `hareket:l14x:beklenen`'i). Öbür L carilerinde fark 0 (S126 alanı — bakım 11 — AYNEN).
- **d38 (189 yeni; dosya yeni, eski kâhinde de koşuldu):** M1 / M2 / M3 / M4 / M5 / M6 / M8 / M9 / M10 / M11 / M16b / M17a 13'er, M7 15, M12 11 (`acikToplam` yok — C14.3), M13 7 (Y12-7 — elle / fatura kalemi yok);
  eski kâhin hepsinde SK-25 ile susuyordu. Fark 0: M14 / M15 (iki kâhinde de susar: SK-18 + SK-25 → SK-26), M16 (iki kâhinde de susar: SK-25 → S125 = C), M17b (kartsız), M18 (S126 AYNEN), M19 (S120 / S122 AYNEN).
- **Öbür 90 eski elle senaryo ve 20 rastgele: fark 0** (adımları değişen eski senaryo 0; öbür türlü O = T Taksitler kartı eski elle senaryolarda yalnız d37 L14'te).
- **Eski ELLE tablolarda değişen beklentiler** (`kahineski12-elle-fark-*.log`; yalnız d37, karar gereği): L14 — 4 `elleYok` + 1 `elleBelirsiz` (SK-25) kalktı, 12 değer eklendi. Öbür 90 dosyanın elle tablosu ve
  bütün dosyaların adımları AYNI (91/91).
- `--kural 2.4.9` / 2.4.6 / 2.4.5 / `--legacy`: **448/448 bayt bayt aynı** (91 eski elle + d38 + 20 rastgele × 4 kip); üretici 20/20 aynı dizi.
- **Yeni / değişen elle tablolar ESKİ (bakım 11) kâhinde — beklenen NEDENLE kırmızı (ders 7, 38):** 656 elle denetimin **176**'sı (`kahineski12-kirmizi-eski-cari-*.log`; d38 165, d37 11): 173'ü "ANAHTAR YOK"
  (eski kâhin SK-25 ile susuyor), 3'ü `belirsiz` kaydında "SK-26" (M14, M15) / "S125 = C + SK-23" (M16) yok (eski kâhin SK-25 yazıyor); 480'i iki kâhinde aynı (bakiyeler, kart tutarları, M14 / M15'in SK-18
  kaydı ve iki dünyada aynı kalanlar, M17b, M18, M19, d37'nin öbür carileri).

### Kanıt (bakım 12; iki saat dilimi — UTC ve Europe/Istanbul çıktıları bayt bayt aynı (başlık satırları dışında); kâhin `7e50f5af`, temiz ağaç; `docs/kanit/2026-11-11/kahineski12-*`, araçlar ve koşu betiği `kahineski12-arac/`)
cari öz test **5.611/5.611** (`-cari-oz-*`: elle tablolar 92 senaryo, mutantlar 200–279 — 219–279 değerle) · mutasyon taraması **246/246** (`-cari-mutasyon-*`) · eşdeğerlik + G3 **560/560** (`-esdeger-cari-*`) ·
yeni / değişen elle tablo **656/656** (`-elle-yeni-cari-*`: d38 294 + d37 362) · ESKİ kâhinde **176 kırmızı** / 656 (`-kirmizi-eski-cari-*`) · eski elle tablo farkı **91/91** izinli (`-elle-fark-*`) · G1 tarama
**92/92** (`-g1-tara-*`) · mutant ↔ senaryo **76/76** (`-mutant-senaryo-*`; d38 / d37 / d36 / d35 × 261–279) · geniş tarama **2.201/2.201** (`-genis-tarama-*`; bakım 11 ile aynı sayı). **Defter öz testi
BAŞARISIZ** (`-defter-oz-*`; `VARSAYILAN_KURAL` AttributeError) — bakım 9 / 10 / 11'deki gibi, TABANDA (`bb05ae9b` eski kopyası) da aynı; bu bakım defter kâhinine dokunmadı. Öz test, mutasyon, eşdeğerlik ve
geniş tarama `flock -s -n …/olcum.lock` ile (ders 52). Program açılmadı. Koşu günlükleri `kahineski12-kos-utc.txt` / `-ist.txt` (yük 2,5 / 3,0 — 4 çekirdek).

## 25. 2.5.0 Ç5 bakımı 14 — S130 (Şüpheli Alacağa alınan tutar 'Tahsil Edilecek' kalemlerinden en eskiden düşer) + S129 (kart penceresinin göstergeleri tek kuyruktan — beklentinin onayı) + S131 / S133 / S134 / S135 = C (BİLİNEN SINIR) (12.11.2026, `date -u` 22:21; kararlar 12.11.2026 13:26 ve 18:21 UTC — ana oturumun özet dosyası; eski kâhinler bakımı 14 — kodu görmeyen AYRI el; TOPLU KÂHİN BAKIMI: Ç5-B paketinin bütün yanıtları tek bakımda) — kural seti `2.5.0` = §13 + … + §24 + bu bölüm

Bu bakım Ç5-B paketinin TOPLU bakımıdır: bir yeni kural (S130 = A), bir beklenti onayı (S129 = A) ve dört BİLİNEN SINIR (S131 / S133 / S134 / S135 = C — kâhin o alt durumlarda SUSAR, kural
yok). S110, S120, S122, S126, S128, S2, S50, S95, S99, S101 ve §13–§24'ün öbür kuralları DEĞİŞMEZ. `--kural 2.4.9` (ve 2.4.6 / 2.4.5 / `--legacy`) AYNEN. Defter kâhini (`test/bagimsiz/defter/`)
DEĞİŞMEZ (S130 bakiyeyi ve yevmiyeyi değiştirmez — karar metni "bakiye değişmez"; 128 / 129 karşılıkları cari kâhininde zaten yok — KS7 (d)).
**Bu bölümün ilk commit'i yalnız YORUMDUR (ders 40 — önce kural, sonra kod); senaryo / mutant / G3 sayıları kod ve kanıt commit'lerinde eklenir.**

### C00r Temiz oda (bakım 14)
- **Girdi (AYNEN; ana oturumun özet dosyası `scratchpad/kahin-eski14-kararlar.md` — "programın hesap / görünüm davranışı hakkında bilgi içermez"; soruların içindeki örnek sayılar kullanıcıya
  gösterilip onaylanan metnin parçasıdır):**
  - S130 SORU (kullanıcıya gösterilen metin — AYNEN): "bir tutar Şüpheli Alacağa alındığında (henüz Değersiz yazılmadan) o tutar carinin 'Tahsil Edilecek' kalemlerinden (takvim / Vade Takip / nakit
    tahmini) düşsün mü? LİSTEDEN OKUNAN (aday; senaryo: açılış 1.000 + fatura 800 + elle borç 500 − stok iadesi 600 = bakiye 1.700; sonra 900 Şüpheli Alacağa alınıyor): program — açılış kalemi 300,
    fatura kalemi yok (kalemler en eskiden 900 azalmış), bakiye 1.700; kâhin — açılış kalemi 1.000, fatura kalemi 200 (kalemler azalmaz, toplamı = bakiye). Değersiz yazıldıktan sonra iki okuma
    AYNI. Bakiye iki okumada AYNI. SEÇENEKLER: A (ÖNERİ) düşsün (bugünkü program: tahsili şüpheli para nakit tahmininde ve tahsil listesinde beklenen para gibi görünmez; Şüpheli Alacaklar'da
    izlenir), kâhin buna göre güncellenir; B düşmesin (kalemler toplamı her zaman bakiyeye eşit; program değişir); C uç durum böyle kalsın (BİLİNEN SINIR — program A'daki gibi kalır, kâhin bu
    durumda susar)."
  - S130 KARAR (kullanıcı 12.11.2026 13:26 UTC, AYNEN: "önerilerini uygula, mikro, netsis, logo, akınsoft gibi piyasada yaygın muhasebe programlarınıda referans alabilirsin"): "S130 = A — Şüpheli
    Alacağa alınan tutar carinin 'Tahsil Edilecek' kalemlerinden (takvim / Vade Takip / nakit tahmini) en eskiden başlayarak DÜŞER, bakiye değişmez; kâhin buna göre güncellenir."
  - S130 NOT (ana oturum, AYNEN): "(1) Bakiye, Şüpheli Alacaklar'daki tutar ve Değersiz yazıldıktan sonraki durum bu karardan ETKİLENMEZ (soru metni: "Değersiz yazıldıktan sonra iki okuma AYNI.
    Bakiye iki okumada AYNI."). (2) Kararın sözü "en eskiden başlayarak"; soru metnindeki örnekte kalemler "açılış kalemi 300, fatura kalemi yok" diye verilmiş (toplam 900 azalmış). "En eski"nin
    neye göre sayıldığı (belge / hareket tarihi, vade, kayıt sırası) kararın sözünden ve bu örnekten TEK biçimde çıkıyorsa onu uygula ve nasıl çıkardığını KARARLAR.md'ye yaz; çıkmıyorsa ya da örnekle
    söz senin modelinde bağdaşmıyorsa UYDURMA: iki okumayı sayılarıyla yaz, yalnız ayrışan alanlarda SUS, "KULLANICIYA SORULMALI"ya koy. (3) Şüpheliye alınan tutarın bir kısmı sonradan TAHSİL
    edilirse / şüpheliden GERİ ALINIRSA / kısmen Değersiz yazılırsa kalemlerin nasıl geri geldiği kararda YOK — kâhinin önceki kurallarından tek biçimde çıkmıyorsa SUS ve raporla. (4) Kalemler
    toplamı artık her zaman bakiyeye eşit DEĞİL: toplam = bakiye − Şüpheli Alacağa alınmış (henüz Değersiz yazılmamış, tahsil edilmemiş) tutar; önceki "kalemler toplamı = bakiye" değişmezin bu
    istisnayla yeniden yaz."
  - S129 SORU (AYNEN): "taksit kartının penceresindeki 'Tahsil Edilen' / 'Kalan' göstergeleri, Taksitler listesindeki aynı sütunlar ve taksit satırının 'Ödenen' sütunu hangi hesaptan? ANA OTURUMUN
    EKRANDAN OKUDUĞU (aday; yürüyüş c5by-yuruyus-ts3; kart 900 = 3 × 300, cariye karta BAĞLANMADAN 500 tahsilat, bakiye 400): pencere üstü 'Tahsil Edilen 0 · Kalan 900 · Geciken 100', taksit
    satırları '1. Ödendi (kalan 0) · 2. Kısmen (kalan 100) · 3. Bekliyor (kalan 300)', tablo toplamı 'Ödenen 0 · Kalan 400', liste 'Tahsil Edilen 0 · Kalan 900'; ikinci örnek (kart 600, bağsız
    tahsilat 800, bakiye −200): liste 'Kalan 600 · Tamamlandı'. Kâhin bu alanlarda kuyruk değerini bekliyor (listede kalan kayıtların büyük kısmı bu sınıf). Bakiye iki okumada AYNI (listede Ç5-B'ye
    ait bakiye farkı YOK — ana oturum sayıyla baktı). SEÇENEKLER: A (ÖNERİ) göstergeler ve 'Ödenen' de kuyruktan — ekranda tek sayı (örnekte Tahsil Edilen 500 · Kalan 400; ikinci örnekte Kalan 0);
    tahsilat formunun sınırı S118 = B'deki gibi kartın kendi kalanından kalır; B göstergeler kartın kendi hesabından kalır (bugünkü program; satırlarla gösterge ayrı sayı gösterir), kâhin buna göre
    güncellenir."
  - S129 KARAR (aynı ileti, AYNEN): "S129 = A — taksit kartının penceresindeki 'Tahsil Edilen' / 'Kalan' göstergeleri, Taksitler listesindeki aynı sütunlar ve taksit satırının 'Ödenen'i de TEK
    KUYRUKTAN gösterilir (ekranda tek sayı: örnekte kart 900, bağsız tahsilat 500 → Tahsil Edilen 500 · Kalan 400; kart 600, bağsız tahsilat 800 → Kalan 0 · Tamamlandı); tahsilat formunun sınırı /
    sorusu / önerilen tutarı S118 = B'deki gibi kartın KENDİ kalanından kalır." NOT (ana oturum, AYNEN): "soru metni kâhinin bu alanlarda zaten kuyruk değerini beklediğini söylüyor; bu karar o
    beklentiyi ONAYLAR. Beklenen: kâhinin bu alanlardaki değerleri DEĞİŞMEZ. Değişmesi gereken bir yer görürsen (örnek: 'Kalan 0 · Tamamlandı' durumu, 'Ödenen' sütunu) önce KARARLAR.md'ye yaz,
    sonra işle; karar örneklerinin iki sayısını elle senaryo olarak ekle."
  - S131 = C (kullanıcı 12.11 13:26), S133 = C, S134 = C, S135 = C (kullanıcı 12.11.2026 18:21 UTC, AYNEN: "hepsi önerin olsun" — üçünde de öneri C idi). Soru metinleri girdi dosyasında AYNEN;
    özetleri: S131 — bakiye kadar açılan kartın içine BAŞKA bir taksit kartının / taksitli faturanın taksitleri de girerse o taksitlerin kendi gösterimi ("C (ÖNERİ) böyle kalsın — BİLİNEN SINIR
    (program bu kartı açtırmıyor; kâhin susar)"); S133 — Taksitler'den ELLE açılan kartın tutarı carinin en son taksitsiz stoktan veresiye satışına eşitse kart hangisini içine alır ("ÖRNEK: elle Borç
    500 (vade ileride) → stoktan satış 500 (vadesiz) → elle kart 500 (iki taksit). A: en son kaydedilen satışı … B: S120'nin harfi — tutarı eşit TEK elle borcu … C (ÖNERİ): Uç durum böyle kalsın —
    BİLİNEN SINIR. Bakiye üç seçenekte de aynı."); S134 — kilitli dönemde birbirini kapatmış (netleşmiş) borç ve alacak, kilitten SONRAKİ bağsız tahsilatla yeniden açılır mı ("ÖRNEK: Borç 1.000 →
    Alacak 300 (netleşir, kalan 700) → dönem kilidi → tahsilat 1.000. A: açılır (… kilitli = kilitsiz, S95'in kuralı) → takvimde 'Ödenecek 300, gecikmiş'. B: kilitli dönemdeki netleşme kalır →
    takvim boş … C (ÖNERİ): Uç durum böyle kalsın — BİLİNEN SINIR (S119 = C ile aynı aile). Bakiye üç seçenekte de −300."); S135 — S126'nın 'kart carinin BÜTÜN açık borcuna eşitse' koşulunda
    carinin BAŞKA bir taksitli faturasının açık taksitleri 'bütün açık borca' sayılır mı ("ÖRNEK: fatura F 600 + elle borç X 300 + ayrıca taksitli fatura B 300; elle kart 900; karta 300 tahsilat.
    A: sayılır … kart yalnız elle borçları içine alır: X kapanır, F 600 açık. B: sayılmaz → S126 işler: F'den 300 kapanır, X 300 açık kalır … C (ÖNERİ): Uç durum böyle kalsın — BİLİNEN SINIR.
    Bakiye üç seçenekte de aynı."). NOT (ana oturum, AYNEN): "bu dört alt durumda kâhinin bugün bir DEĞER verip vermediğine bak. Değer veriyorsa ve o değer yukarıdaki sorularda yazan iki okumadan
    birine dayanıyorsa, o alt durumda (yalnız ayrışan alanlarda — bakiye iki okumada aynıdır, bakiye beklenir) SUS'a çevir ve KARARLAR.md'ye "BİLİNEN SINIR" diye yaz. Kararların kapsadığı ana
    durumlar (S95, S110, S120, S126'nın kendi örnekleri) AYNEN değer vermeye devam eder."
- **Birlikte okunan (kâhinin kendi belgesi):** bu dosyanın §8 C6 (S1, K6.3, K6.5, KS7 — (b) "Şüpheli Alacağa Al kapatıcı DEĞİL", ŞÜPHELİ KALAN), §13 C13.4 (1)–(11) / C13.5, §16 C16.1 / C16.2,
  §17 (S95 — Y5-1 (b), `_geri5`), §19 (SK-18), §21 (Y9-2, SK-20), §22–§24 (bütünü); `model.py` şüpheli (`supheli_durum`, `supheli_al`, `degersiz`), kuyruk (`_tyk`, `_alacak_govde250`, `tyk250`),
  görünüm (`kontrol_v3`, `_cari_kalemleri`, `_belirsiz_uyeler`, `kontrol_gorunum`, `kontrol_acik_toplam`), net görünüm (`_net_uygun`, `net_durum`, `net250`, `_k2_5`, `_geri5`), kilit
  (`donem_kilitle`); c7 / c7b / d35 / d38 elle senaryoları ve `docs/kanit/2026-11-11/kahineski12-arac/` araçları. Okunan / okunmayan dosyaların tam listesi (satır aralıklarıyla) ajan raporunda.
- **Okunmayan:** `server/**`, `client/**`, `bulut/**`, `packaging/**`, `tools/**` (yalnız `kanit.mjs` çalıştırılır), `docs/erp/C5-ACILIS-TASARIM.md`, `docs/erp/C5B-TYK-TASARIM.md`, `docs/devir/**`,
  `docs/2.5.0-IS-LISTESI*.md` (hiçbir sürümü), `test/bagimsiz/cari/YAPIM-ASAMASI.json`, `kos.mjs`, iki kâhin klasörü dışındaki `test/**`, başka ajanların `docs/kanit/**` dosyaları (yalnız
  `kahineski12-arac/` araçları), git farkı / geçmiş içeriği. Program koşulmadı; programın davranışı aranmadı. CLAUDE.md "Açık iş"teki program durumu kural / beklenti kaynağı sayılmadı.

### Kâhinin BUGÜNKÜ (bakım 12, çalışma dalı `86531a4a`) okuması — altı kararın alanında (açıkça)
- **S130:** KS7 (b) — Şüpheli Alacağa Al kapatıcı değil, görünüme de dokunmuyor: takvim / Vade Takip / projeksiyon kalemi = kuyruk kalanı (şüpheli kısım dahil) — **S130 B**. Kararın örneği c7 `k3`'tür
  (kâhin: açılış kalemi 1.000, fatura kalemi 200, Borç 500 — toplam 1.700 = bakiye; sorunun "kâhin" satırı). Şüpheli kayıtlı caride gecikmiş (C13.5), görünüm toplamı (`_cari_kalemleri`) ve
  `acikToplam` YAZILMIYOR (tanımsız).
- **S129:** kart ödeneni / kalanı / taksit ödeneni TEK KUYRUKTAN (C13.4 (5) / (7) — kart tahsilatı + S50 payı; `kart_odenen`) — kararın A'sı. Değişen değer YOK (aşağıda Y14-10).
- **S131:** değer YOK — bakım 12'nin SK-18 (kartın kabulü iki dünya) + SK-26 (kalemin kendi gösterimi) susması.
- **S133:** DEĞER veriyor — §21 Y9-2 ("TEK elle borç … öbür kalemlerden biri (… stok satışı …) de T'ye eşit olsa bile") = S133'ün **B**'si.
- **S134:** DEĞER veriyor — net görünüm (C16.2 / §17) dönem kilidini görmez (`donem_kilitle` yalnız vade alanı düzeltmesini kilitler); S95 A'nın geri alması kilitli günlerde de işler = S134'ün **A**'sı.
- **S135:** değer YOK — taksitli faturanın açık taksitleri O'ya sayılır (S135'in A'sı: O > T → S120 elle kolu), elle borç toplamı < T → SK-20 (S123 = C) ile susuyor. B'nin değeri hiç yazılmıyor.

### Yorumlar (ders 40 — kararlardan; kod yazılmadan ÖNCE; baş mimar kullanıcıya gösterir)
- **Y14-1 — S130'un alanı ("'Tahsil Edilecek' kalemleri (takvim / Vade Takip / nakit tahmini)"):** carinin borç yönlü (in) beklenen para kalemleri — takvim / zil (`takvim:hareket`, `takvim:fatura`),
  Vade Takip (`vadeTakip:hareket`), Nakit Akış Projeksiyonu (`projeksiyon:hareket`), bunların sayaçları (`takvim:cariKalemSayisi`, `projeksiyon:cari`) ve carinin görünüm toplamı (`cariToplam`).
  **DEĞİŞMEYEN (tek okuma):** bakiye ("bakiye değişmez"; NOT (1)), Şüpheli Alacaklar'daki tutar / şüpheli kalan (NOT (1)), elle kaydın Kalan'ı ve faturanın açığı (defter / belge durumu — KS7 (b)
  "Şüpheli Alacağa Al kapatıcı DEĞİL" sürer: kararın sözü yalnız üç beklenen-para görünümünü sayıyor, soru "Şüpheli Alacaklar'da izlenir" diyor; kapama Değersiz Alacak Yaz ile — KS7 (b) / (d)),
  mizan, kart göstergeleri. Gecikmiş (C13.5 — şüpheli kayıtlı cari tanımsız) DEĞİŞMEZ → **SK-29**.
- **Y14-2 — "en eskiden başlayarak" = tek yükümlülük kuyruğunun sırası (C13.4 (2): vade → belge → yazım) — NOT (2) TEK okumayla çıkıyor:** kararın örneğinde (c7 düzeni: Açılış 1.000 belge 01.05 vade
  31.05 · F1 800 belge = vade 20.05 · Borç 500 belge 25.05 vade 12.06 · 05.06 stok Satış İadesi 600) iade sonrası kuyruk F1 200, Açılış 1.000, Borç 500. Vade sırası F1 → Açılış → Borç: 900 = F1'in 200'ü
  + Açılış'ın 700'ü ⇒ **Açılış kalemi 300, fatura kalemi yok, Borç 500** — sorudaki program satırı ("açılış kalemi 300, fatura kalemi yok … kalemler en eskiden 900 azalmış") ile AYNI. Belge (hareket)
  tarihi sırası Açılış → F1 → Borç (kayıt sırası da aynı) ⇒ Açılış 100, F1 200 — örnekle BAĞDAŞMIYOR. Yalnız TYK sırası örneği veriyor; aynı sıra iadenin kendisini de dağıttı (F1'i önce kapattı) ve
  Değersiz Alacak Yaz'ın (bağsız kapatıcı — KS7 (b)) sırasıdır. Mutant 285: belge tarihi sırası.
- **Y14-3 — düşen tutar R (NOT (4)):** R = carinin şüpheli kayıtlarının KALANLARI toplamı (ŞÜPHELİ KALAN: alınan − şüpheliden düşen alacak satırları − Değersiz) = "Şüpheli Alacağa alınmış (henüz
  Değersiz yazılmamış, tahsil edilmemiş) tutar". R = 0 (kayıt tamamen Değersiz yazılmış / tahsil edilmiş) → görünüm bakım 12 AYNEN ("Değersiz yazıldıktan sonra iki okuma AYNI"). Mutant 284
  (Değersiz sonrasını değiştiren okuma): R = alınan − düşen alacak satırları (Değersiz düşülmez) — Değersiz yazılınca kalemler bir kez daha düşer.
- **Y14-4 — kural:** görünen tutar = kuyruk kalanı − R'nin o kaleme düşen payı; R, kontrol anındaki kuyruk kalanlarına Y14-2 sırasıyla birikimli dağılır (ilk kalem bitene dek ona, sonra
  ikinciye …). Kararın örneği AYNEN (yukarıda). R kalemlerin toplamını aşarsa (yalnız şüpheli kaydından ÖNCE tarihli bir alacak satırı sonradan girilince — ŞÜPHELİ KALAN: o satır şüpheliden düşmez)
  bütün kalemler 0 olur (düşecek kalem kalmaz; görünüm toplamı 0). Kaynağı tek: bütün okumalarda kalem 0 (Y14-5'in iki okuması da) → DEĞER.
- **Y14-5 — NOT (3) ve zaman: iki okuma, ayrışırsa SUS (SK-28 (a)):** kararın sözü "Şüpheli Alacağa alınan tutar … en eskiden … düşer" iki biçimde okunabiliyor — (O1) "kontrol anında": carinin O ANKİ
  kuyruk kalanlarından R en eskiden düşer (Y14-4); (O2) "şüphelinin gününde": Şüpheli Alacağa Al kendi gününde, o gün açık kalemlerden en eskiden düşer (C13.4 (4)'ün ANINDA ilkesi — bağsız kapatıcı
  gibi); sonra şüpheliden düşen alacak satırları ve o kaydın Değersiz'i şüpheli tutarın PARÇASIDIR, kalemleri ayrıca kapatmaz (artanı kendi gününde bağsız alacaktır); sonra doğan kalem kendi
  tutarıyla girer. **Şüpheli kaydından sonra doğan borç kalemi YOKSA iki okuma her durumda AYNI** (kısmen tahsilat, tahsilatın şüpheliyi aşması, kısmen / tam Değersiz, birden çok şüpheli kaydı —
  bütün kapanmalar aynı sırada baştan birikir, toplamları aynı) → **DEĞER** (NOT (3)'ün "kısmen tahsil / kısmen Değersiz" kolu bu alanda tek okuma). Sonradan doğan kalem sırada şüpheliden etkilenen
  kalemlerden sonra geliyorsa da AYNI → DEĞER. Kâhin iki okumayı ayrı ayrı hesaplar; herhangi bir kalemin görünen tutarı ayrışıyorsa o carinin S130 görünümü (takvim / Vade Takip / projeksiyon
  kalemleri, sayaçlar, görünüm toplamı) YAZILMAZ — neden "… KULLANICIYA SORULMALI SK-28 (§25)"; bakiye, Kalan, fatura açığı, vade alanları yazılır. Bir üçüncü okuma ("tahsil edilen kısım da
  kalemlerden düşmeye devam eder") NOT (4)'ün tanımıyla ("tahsil edilmemiş") çelişir — okuma sayılmadı. Şüpheliden GERİ ALMA kâhinin dilinde yok (ÖNCEKİ DENENMEYEN — "karşılık / Şüpheliden
  Çıkar") → DENENMEYEN.
- **Y14-6 — kararın söylemediği kalem / ödeme türleri (SUS):** (a) R > 0 iken carinin etkin taksit kartı, taksitli satış faturası ya da verilen avans kalemi (S96 — Ödeme / ciro) varsa: taksit
  kalemlerinin ve avans kaleminin "Tahsil Edilecek" kalem sayılıp sayılmadığı ve sıradaki yeri kararda yok → **SK-27** (S130 görünümü yazılmaz; kart göstergeleri, Kalan, fatura açığı, bakiye
  yazılır — kart göstergeleri Y14-1 gereği zaten değişmez). (b) şüpheliden düşen alacak satırı BAĞLI bir ödemeyse (faturaya bağlı çek / senet — §3.11b (b)'nin istisnası yalnız bağlı TAHSİLAT;
  iade faturası) ya da elle Alacak ise: ödeme kendi faturasını da kapatıyor (C13.4 (3)), şüpheliden de düşüyor — düşüşün kalemlere etkisi iki okumalı → **SK-28 (b)** (SUS, aynı düzen). Elle Alacak /
  karşı yönlü kalemli cari C16.2'de zaten "şüpheli / değersiz alacak" ile tanımsız (değişmedi).
- **Y14-7 — Değersiz Alacak Yaz (NOT (1) / (3)):** Değersiz yazılan kısım TYK'de bağsız kapatıcıdır (KS7 (b), C13.4 (4)) ve R'den düşer; görünen = kuyruk kalanı − (kalan R'nin payı). Tam Değersiz → R = 0
  → bakım 12 AYNEN. Kararın örneğinde Değersiz 900 (09.06) → F1 0, Açılış 300, Borç 500 — şüpheliye alındığı andaki görünümle AYNI (sorunun "Değersiz yazıldıktan sonra iki okuma AYNI"sı); Kalan
  Açılış 1.000 → 300, F1 açığı 200 → 0, bakiye 1.700 → 800 (KS7 (b) / (d) aynen).
- **Y14-8 — NOT (4): "kalemler toplamı = bakiye" değişmezinin yeni hâli:** tek yönlü, kartsız, dağıtılmamış parası olmayan caride Σ görünen 'Tahsil Edilecek' kalemleri = bakiye − R (R ≤ Σ kuyruk
  kalanı iken; aşarsa 0 — Y14-4). R = 0'da eski K6.5 (1) + KS8.1 değişmezi ("Σ bütün kalemler = bakiye") AYNEN. Görünüm toplamı (`cariToplam` — `_cari_kalemleri`) artık şüpheli kayıtlı caride de
  (S130 değer alanında) yazılır = bakiye − R (bakım 12'ye kadar şüpheli cari tanımsızdı — S130 yerini verdi). Defter tarafının değişmezi (KS8.1: Σ açık = bakiye — `acikToplam`) Kalan / açık
  değişmediği için aynıdır; şüpheli kayıtlı caride önceden olduğu gibi yazılmaz (değişmedi). Elle tablo betiği her S130 değer carisinde Σ görünen = bakiye − R'yi assert eder.
- **Y14-9 — etiket:** S130'un değiştirdiği her görünüm denetimi KULLANICI (S130 A); değişmeyenler kendi etiketiyle.
- **Y14-10 — S129 (onay; NOT):** kâhinin bu alanlardaki beklentisi DEĞİŞMEZ: `kart:<no>:odenen` = kartın taksitlerinin TYK'de kapanan toplamı (kart tahsilatı + kart seçilmeden alınan tahsilatın S50
  payı — "Tahsil Edilen"), `kart:<no>:kalan` = tutar − ödenen ("Kalan"), `kart:<no>:taksit<i>:odenen` = taksitin TYK payı (taksit satırının "Ödenen"i; satırın kalanı tutar − ödenen). Kararın iki
  örneği elle senaryoya girer: kart 900 (3 × 300), bağsız tahsilat 500 → ödenen 500, kalan 400, taksitler 300 / 200 / 0, bakiye 400; kart 600 (2 × 300), bağsız tahsilat 800 → ödenen 600, kalan 0,
  taksitler 300 / 300, bakiye −200. Kâhinin dilinde kartın / taksitin DURUM anahtarı ("Tamamlandı", "Ödendi / Kısmen / Bekliyor") ve tahsilat formunun sınırı (S118 = B) YOK — eklenmedi (ana
  oturuma: gerekirse koşucuya ayrı anahtar; DENENMEYEN).
- **Y14-11 — S131 = C:** kâhin bugün değer vermiyor (SK-18 + SK-26) → susma AYNEN; SK-26 nedeni "… BİLİNEN SINIR (kullanıcı kararı S131 = C) SK-26" olur (KULLANICIYA SORULMALI değil). SK-18'in bu
  durumdaki (bakiye kadar kart başka kartın / taksitli faturanın taksitini de tüketiyor) susması da S131 = C ile BİLİNEN SINIR'dır; SK-18'in öbür durumları (müşteri hem tedarikçi, verilen avans — §19)
  açık soru olarak kalır (metin değişmez).
- **Y14-12 — S133 = C — DEĞER'den SUS'a:** alan: Taksitler'den açılan kart, S110 tetiği (O > T), Y9-2 "kendi" (açık tutarı T'ye eşit TEK elle borç) ve carinin kartın gününe kadarki EN SON (belge tarihi →
  yazım sırası) stok veresiye satışının (KS7.1) tutarı T'ye eşit, kart gününde açık. İki okuma (S133 A: kart o satışı içine alır — elle borç kendi vadesiyle ayrı; B: elle borcu — Y9-2) kartın neyi
  tükettiğini, dolayısıyla Kalan'ı, takvimi, gecikmişi ve sonraki ödemelerin taksitlere düşüşünü (kart ödeneni) ayırır → cari C13.4 (11) düzeninde SUSAR (yazılanlar bakiye ve kart tutarı — iki
  okumada aynı); neden "… BİLİNEN SINIR (kullanıcı kararı S133 = C) S133 (§25)". Kartın günündeki en son stok satışı T'ye eşit değilse (ya da yoksa) Y9-2 AYNEN (S120'nin kendi örnekleri değişmez).
- **Y14-13 — S134 = C — DEĞER'den SUS'a:** alan: net görünüm caride (C16.2 'net'), dönem kilidi (`lockedUntil`) varken, kilit tarihine kadar (≤ kilit) yapılmış iki kalem netleşmesinin kilitten SONRAKİ
  bağsız ödemeyle geri alınması (S95 A — Y5-1 (b)) görünümü değiştiriyor. Kâhin iki okumayı hesaplar (A: geri alınır — bugünkü; B: kilitli günlerdeki netleşme kesin); net kalanlar ya da avans
  ayrışırsa cari C16.2 'tanımsız' düzeninde (bakiye, belge durumu, mizan yazılır; Kalan, takvim / Vade Takip / projeksiyon, gecikmiş yazılmaz) — neden "… BİLİNEN SINIR (kullanıcı kararı S134 = C)
  S134 (§25)". Kilit yoksa ya da iki okuma aynıysa S95 / §17 AYNEN (S95'in kendi örnekleri — d20 — değişmez).
- **Y14-14 — S135 = C:** kâhin bugün değer vermiyor (SK-20 susması) → susma AYNEN; SK-20 nedenine, öbür taksit kartlarının / taksitli faturaların açık taksitleri O'dan çıkınca O = T oluyorsa
  "· BİLİNEN SINIR (kullanıcı kararı S135 = C) S135" eklenir (yalnız metin).
- **Y14-15 — DEĞİŞMEYEN:** şüphelisiz carilerin bütün denetimleri; şüpheli kayıtlı caride bakiye, Kalan, fatura açığı / belge durumu, şüpheli kalan ve Değersiz ret kodları (ŞÜPHELİ KALAN), mizan;
  S110 / S120 / S122 / S126 / S128 (S133 alt durumu dışında), S95 (S134 alt durumu dışında), gecikmiş C13.5 / C16.4, `--kural 2.4.9` ve öncesi.

### Altı kararın alt durumları (açıkça)
| Alt durum | Bakım 12 | Bakım 14 |
|---|---|---|
| S130: R > 0, kartsız / avanssız, tek yönlü cari, iki okuma (Y14-5) aynı — kararın örneği, kısmen tahsilat / Değersiz, birden çok kayıt | kalem = kuyruk kalanı (S130 B) | **DEĞER** (Y14-4; toplam = bakiye − R) |
| S130: R = 0 (tam Değersiz / tahsil) | kalem = kuyruk kalanı | **DEĞER** — değişmedi (görünüm toplamı artık yazılır = bakiye) |
| S130: şüpheliden sonra doğan kalem iki okumayı ayırıyor | kalem = kuyruk kalanı | **SUS** — KULLANICIYA SORULMALI SK-28 (a) |
| S130: şüpheliden düşen bağlı çek / iade faturası | kalem = kuyruk kalanı | **SUS** — KULLANICIYA SORULMALI SK-28 (b) |
| S130: taksit kartı / taksitli fatura / verilen avans kalemi | kalem = kuyruk kalanı (kart kurallarıyla) | **SUS** — KULLANICIYA SORULMALI SK-27 |
| Şüpheli kayıtlı caride gecikmiş | SUS (C13.5) | SUS — KULLANICIYA SORULMALI SK-29 |
| S129 kart göstergeleri | DEĞER (kuyruk) | DEĞER — değişmedi (karar onayı) |
| S131 | SUS (SK-18 + SK-26) | SUS — BİLİNEN SINIR (S131 = C) |
| S133 | DEĞER (Y9-2 = B) | **SUS** — BİLİNEN SINIR (S133 = C) |
| S134 | DEĞER (S95 A — kilit görülmez) | **SUS** (iki okuma ayrışırsa) — BİLİNEN SINIR (S134 = C) |
| S135 | SUS (SK-20) | SUS — BİLİNEN SINIR (S135 = C) metni eklendi |

### KULLANICIYA SORULMALI (bakım 14; kâhin bu durumlarda SUSAR — ders 43, SORU DÜZENİ; bakiye her seçenekte aynı)
- **SK-27 (S130 × taksit kartı / taksitli fatura / verilen avans — Şüpheli Alacağa alınan tutar taksit kalemlerinden de düşer mi; UÇ DURUM DEĞİL — taksitlendirilmiş her şüpheli müşteride):**
  01.04 Borç X 400 · 15.04 Taksitler'den kart 400 (2 × 200: 01.05, 01.06; kart X'i içine alır — O = T) · 10.05 satış faturası F 600 · 20.05 Şüpheli Alacağa Al 300; bugün 25.05. Bakiye 1.000; kuyruk sırası
  taksit 1 (01.05) → F (10.05) → taksit 2 (01.06). **A (öneri — kalemin türüne bakılmadan kuyruk sırasıyla, S128'in düzeni):** taksit 1 kalemi yok, F 500, taksit 2 200 (toplam 700) / **B (taksitler
  kendi tutarıyla kalır; şüpheli tutar yalnız kart dışı kalemlerden):** F 300, taksit 1 200, taksit 2 200 (toplam 700) / **C:** uç durum böyle kalsın (BİLİNEN SINIR). Kartın göstergeleri (Tahsil
  Edilen 0 · Kalan 400) iki okumada da DEĞİŞMEZ (S130 yalnız takvim / Vade Takip / nakit tahmini). Aynı soru verilen avans kalemi (S96 "Tahsil Edilecek Borç") için: A sırasıyla düşer / B düşmez.
- **SK-28 (a) (S130 × zaman — şüpheliye aldıktan SONRA doğan, sırada önce gelen borç; UÇ DURUM):** 01.06 Borç X 600 (vade 30.06) · 05.06 Şüpheli Alacağa Al 400 · 08.06 satış faturası F 300 (vadesiz)
  · bugün 15.06. Bakiye 900; görünen toplam iki okumada 500. **A (öneri — o anki kalemlerden en eskiden; Değersiz sonradan yazılınca görünüm DEĞİŞMEZ: 16.06'da Değersiz 400 → F 0, X 500):**
  F kalemi yok, X 500 / **B (şüphelinin günündeki kalemlerden; sonra doğan kalem kendi tutarıyla):** X 200, F 300 / **C:** uç durum böyle kalsın (BİLİNEN SINIR). (Aynı ayrışma şüpheliden
  düşen tahsilat sonra doğan kalemle birlikte olunca da çıkar: + 10.06 tahsilat 200 → A: F yok, X 500 · B: X 200, F 300; bakiye 700.)
- **SK-28 (b) (S130 × şüpheliden düşen BAĞLI ödeme; UÇ DURUM):** 01.06 fatura F 800 · 02.06 Borç X 500 · 05.06 Şüpheli Alacağa Al 900 · 08.06 F'ye bağlı çek 300 (§3.11b: yalnız bağlı TAHSİLAT
  şüpheliden düşmez — çek düşer; şüpheli kalan 600). Bakiye 1.000. **A (öneri — Y14-4 aynen: kalan şüpheli 600 kuyruktan en eskiden; çek F'yi önce kapatır):** F kalemi yok, X 400 (toplam 400 =
  bakiye − 600) / **B (çek yalnız F'yi kapatır, şüpheliye alınan 900'ün düşüşü değişmez):** F yok, X 100 (toplam 100) / **C:** uç durum böyle kalsın (BİLİNEN SINIR). Aynı soru iade faturası için.
- **SK-29 (şüpheli kayıtlı caride gecikmiş tutarı — S130 ile aynı mı; UÇ DURUM DEĞİL):** kararın örneği (bugün 15.06; F1 200 (20.05), Açılış 1.000 (vade 31.05), Borç 500 (vade 12.06) — hepsinin vadesi
  geçmiş; Şüpheli 900). **A (öneri — S130'un devamı: gecikmiş de görünen kalemlerden):** 300 + 500 = 800 / **B (gecikmiş defter kuyruğundan, şüpheli dahil — C13.5'in formülü):** min(1.700, 1.700) =
  1.700. Bakiye 1.700 iki seçenekte. (Kâhin bakım 4'ten beri şüpheli kayıtlı caride gecikmişi yazmıyor — değişmedi.)

### Kurallar (kod commit'i; yorumların `model.py`'deki karşılığı)
- **C25.1 `_supheli_hesap`:** `supheli_durum`'un hesabı (kalan AYNEN — bakım 12 ile bayt bayt; `--kural 2.4.9` ve öncesi aynı yol) + iz: şüpheliden düşen her alacak satırının düşen kısmı (`("t" | "e" | "h" | "i" | "x",
  kimlik, bağ)`) ve kayıt başına Değersiz toplamı.
- **C25.2 `s130(cari)` (Y14-1 … Y14-6; yalnız `2.5.0`):** R = Σ şüpheli kalan (Y14-3); R = 0 → görünen = kuyruk kalanı (iz "sifir"); R > 0 iken etkin taksit kartı / taksitli satış faturası / verilen avans (Ödeme,
  ciro) → SUS SK-27; şüpheliden düşen satır bağlı (faturaya bağlı çek / senet, iade faturası) ya da elle Alacak → SUS SK-28 (b); öbür durumda O1 = kuyruk kalanından R'nin `_anahtar250(v, d, s)` sırasıyla
  birikimli düşürülmesi, O2 = `_alacak_govde250(…, s130_mod)` (şüpheli kaydı kendi gününde 'd' havuzunda bağsız kapatıcı; o carinin Değersiz kapatıcıları çıkarılır; şüpheliden düşen tahsilat / evrak / stok
  iadesinin düşen kısmı kaynaktan düşülür); O1 ≠ O2 → SUS SK-28 (a); eşitse görünen = O1 (iz "alan"). `kontrol()` SUS'u `belirsiz`'e "cari <ad> S130 görünümü tanımsız (2.5.0 §25): <neden>" diye yazar.
- **C25.3 görünüm (Y14-1 / Y14-4 / Y14-8 / Y14-9):** `kontrol_v3` hareket kalemleri — Kalan / vade / beklenen yazıldıktan SONRA: SUS → kalem yazılmaz, sayaç bilinmiyor (`sayim_kesin` False); "alan" → borç yönlü
  kalemin takvim / Vade Takip / projeksiyon tutarı = görünen, etiket KULLANICI; verilen avans kalemi SUS'ta yazılmaz; fatura kalemleri (`takvim:fatura`) SUS'ta yazılmaz, "alan"da satış faturası görünen tutarla
  (etiket KULLANICI). `_cari_kalemleri`: şüpheli kayıtlı cari artık tanımsız DEĞİL — kartsız ve S130 değeri varsa kalemler görünen tutarla, denetim Σ = bakiye − (Σ kuyruk − Σ görünen); `_belirsiz_uyeler`
  stok / karşılıksız kalemini görünen tutarla sayar. `kontrol_acik_toplam` ve gecikmiş (şüpheli kayıtlı cari) DEĞİŞMEDİ.
- **C25.4 S133 (Y14-12) `_tyk` S110 elle kolu:** Y9-2 "kendi" seçilince carinin kartın gününde açık (kuyruğa girmiş) stok veresiye satışlarının belge tarihi → yazım sırasıyla EN SONUNCUSUNUN tutarı kart tutarına
  eşit ve kalanı > 0 ise `("sus", …, "S133", satış)` — neden "… BİLİNEN SINIR (kullanıcı kararı S133 = C) S133 (§25 Y14-12)"; tüketim Y9-2 düzeniyle sürer (cari C13.4 (11) düzeninde susar).
- **C25.5 S134 (Y14-13):** `_geri5` — `_s134b` bayrağı açıkken netleşme günü ≤ kilit < ödeme günü ise geri alınmaz (yalnız karşılaştırma); `net250` dönem kilidi varken ilk okumayı (K2) bayrakla bir kez daha
  koşar, net kalanlar ya da verilen avans satırları ayrışırsa `"s134": True`; `net_durum` → ("tanimsiz", "… BİLİNEN SINIR (kullanıcı kararı S134 = C) S134 (§25 Y14-13)"), `gecikmis250` → None.
- **C25.6 S135 (Y14-14):** SK-20 tuple'ına yedinci öğe (öbür kartların / taksitli faturaların açık taksitleri O'dan çıkınca O = T mi); doğruysa neden metnine "· … BİLİNEN SINIR (kullanıcı kararı S135 = C) S135
  (§25 Y14-14)". **C25.7 S131 (Y14-11):** SK-26 nedeni "… BİLİNEN SINIR (kullanıcı kararı S131 = C) SK-26 (§24, §25 Y14-11; kartın kabulü ayrıca SK-18)".
- Mutantlar 280–285 (`MUTASYONLAR`): 280 S130 B (kalemler düşmez) · 281 en yeniden · 282 orantılı · 283 bakiye de düşer · 284 Değersiz R'den düşülmez (Değersiz sonrası değişir) · 285 "en eski" belge tarihi.
- `--kural 2.4.9` / 2.4.6 / 2.4.5 / `--legacy`: hiçbir yol değişmedi (`s130` ve S134 karşılaştırması yalnız `k250`; `_supheli_hesap` kalanı aynen; S133 dalı `k250` içindeki S110 kolunda; S135 / S131 yalnız neden metni).

### C8r Nasıl bozulur? (bakım 14 — kod commit'inde, senaryolarla birlikte yazıldı)
| # | Bozulma | Senaryo |
|---|---|---|
| Z159 | Şüpheli Alacağa alınan tutar kalemlerden düşmez (S130 B) | d39 N1 … N4, N6, N7, N10 … N13a (mutant 280) |
| Z160 | Tutar en yeniden düşer | d39 N1, N2, N3, N6, N7, N10, N12 (mutant 281) |
| Z161 | Tutar orantılı dağılır | d39 N1, N2, N3, N6, N7, N10, N12 (mutant 282) |
| Z162 | "En eski" belge tarihine göre (vade sırası değil) — kararın örneği | d39 N1 (mutant 285) |
| Z163 | Şüpheliye alma bakiyeyi / Kalan'ı / fatura açığını da değiştirir | bakiye: d39 N1 … N4, N6, N7, N10 … N13a, d40 Q1 … Q4 (mutant 283); Kalan / açık: d39 her N carisi (elle değer) |
| Z164 | Değersiz yazılınca kalemler bir kez daha düşer (Değersiz sonrası değişir) | d39 N1b, N5, N6 (mutant 284) |
| Z165 | Kısmen tahsilat / tahsilatın şüpheliyi aşması / kısmen Değersiz yanlış R | d39 N6, N7, N8 |
| Z166 | Şüpheli kalan kalemleri aşınca eksi kalem / toplam | d39 N11 |
| Z167 | Sonradan doğan kalemde değer uydurulur (iki okuma ayrışıyor) ya da ayrışmazken susulur | d40 Q1 / Q1b (SUS), d39 N10 (değer) |
| Z168 | Bağlı çek / taksit kartı / verilen avansla değer uydurulur; kart göstergeleri değişir | d40 Q2 (SK-28 (b)), Q3 (SK-27; kart 400 / 0), Q4 (SK-27; avans kalemi yazılmaz) |
| Z169 | S133: en son satış karta eşitken değer uydurulur ya da eşit değilken Y9-2 bozulur | d40 Q5 (SUS), Q5b (değer) |
| Z170 | S134: kilitli netleşmede değer uydurulur ya da kilitten sonraki netleşmede S95 bozulur | d40 Q6 (SUS), Q7 (değer) |
| Z171 | S135 / S131 susmasında değer uydurulur ya da neden "KULLANICIYA SORULMALI" kalır | d40 Q8, d38 M14 / M15 |
| Z172 | Aynı adlı iki cari karışır; şüphelisiz carinin kalemi düşer; görünüm toplamı / sayaç bozulur | d39 N13a / N13b, `cariKalemSayisi` / `projeksiyon:cari` |

### Senaryolar (bakım 14; elle tablolar — kâhin koşulmadan karar metinlerinden ve §8 / §13 / §16 / §17 / §21 / §25'ten; betikler `docs/kanit/2026-11-12/kahineski14-arac/yeni-senaryolar14.py`, `d38-guncelle14.py`, adımların yeri `g1-sirala.py`)
- **`d39-c5-s130-supheli-kalemleri`** (bugün 15.06.2026; 234 elle denetim = 195 değer + 39 yok): N1 kararın örneği AYNEN (Açılış kalemi 300, fatura kalemi yok, Borç 500; Kalan Açılış 1.000 / Borç 500, fatura açığı
  200, bakiye 1.700; görünüm toplamı 800 = 1.700 − 900) · N1b Değersiz 900 sonrası (kalemler aynı; Kalan Açılış 300, açık 0, bakiye 800) · N2 ilk kalemi tam bitirir (F yok, x 300) · N3 aşar (x 200) · N4 hepsini
  bitirir (0) · N5 tam Değersiz (R 0; x 200) · N6 kısmen Değersiz 200 (R 300; F yok, x 200; Kalan x 300, F açığı 200) · N7 kısmen tahsilat 200 (aynı) · N8 tahsilat şüpheliyi aşar (R 0) · N10 sonradan doğan kalem
  sırada sonra (x 200, F 300 — değer) · N11 şüpheli kalan kalemleri aşar (kalem yok, toplam 0) · N12 iki şüpheli kaydı (x yok, y 400) · N13a / N13b aynı adlı iki cari (300 / 500 — şüphelisiz değişmez) · P1 / P2
  S129'un iki örneği (ödenen 500 · kalan 400, taksitler 300 / 200 / 0, bakiye 400; ödenen 600 · kalan 0, 300 / 300, bakiye −200) · P3 Yeni Borç kartıyla S129 · sayaçlar `cariKalemSayisi` = `projeksiyon:cari` = 14.
  Her S130 değer carisinde Σ görünen = bakiye − R (R kalemleri aşarsa 0) betikte assert edildi (Y14-8). Şüpheli kayıtlı caride gecikmiş ve `acikToplam` `elleYok` (değişmedi — SK-29).
- **`d40-c5-s130-sus-bilinen-sinir`** (bugün 15.06.2026; 94 elle denetim = 42 değer + 44 yok + 8 belirsiz): Q1 / Q1b SK-28 (a) SUS (Kalan, vade, fatura açığı, bakiye yazılır) · Q2 SK-28 (b) bağlı çek SUS · Q3 SK-27
  taksit kartı SUS (kart göstergeleri 400 / 0 değişmez) · Q4 SK-27 verilen avans SUS (avans kalemi de yok) · Q5 S133 = C SUS (bakiye 1.000, kart tutarı) · Q5b en son satış karta eşit değil — Y9-2 değer (x Kalan 500,
  takvim yok, kart 500 / 0, gecikmiş 1.300) · Q6 S134 = C SUS (bakiye −300) · Q7 kilitten sonraki netleşme — S95 değer (Borç Kalan 0, Alacak Kalan 300, "Ödenecek Borç" 300 gecikmiş −13) · Q8 S135 = C
  (SK-20 + S135 metni; bakiye 900, kart tutarı).
- **`d38-c5-s128-ozge-kalemli-kart` M14 / M15 (S131 = C):** `elleBelirsiz` kaydına "BİLİNEN SINIR", "S131 = C" eklendi; adımlar ve değer beklentileri AYNEN (d38 294 elle denetim).
- **İlk koşu:** 328 yeni elle denetimin (d39 234 + d40 94) hepsi kâhinle aynı; d38 294/294. Koşudan sonra değişen elle DEĞER yok — yalnız d40'ta Q8'in adımları senaryonun başına alındı (dönem kilidi
  adımı G1 sıralamasında sınır olduğundan Q8'in mart faturaları haziran faturalarından sonraya düşmüştü — G1 taraması yakaladı; değerler aynı, koşu yinelendi: 328/328). Elle değerler yazılmadan önce kâhin
  S130 alanında koşulmadı / çıktısına bakılmadı (geliştirme sırasındaki tek bakış: eski ↔ yeni kâhinin eski elle senaryolardaki farkı — c7 `k3`'ün dört görünüm denetimi, kararın örneği).

### C10r Mutantlar (bakım 14; `oz-test.py` DEĞERLE — çökmeden, elle tablo kırmızı)
280 S130 B (kalemler düşmez) · 281 en yeniden · 282 orantılı · 283 bakiye de düşer · 284 Değersiz sonrası değişir (R'den Değersiz düşülmez) · 285 "en eski" belge tarihi. Hepsi d39'da DEĞERLE (283 d40'ta da). Bakım 6
… 12 mutantları (241–279) aynen yakalanıyor (`oz-test.py`; `mutant-senaryo.py` 261–285 × d35 … d40).

### Dil ekleri (/3, bakım 14)
Yeni adım YOK; yeni çıktı anahtarı YOK — şüpheli kayıtlı carinin görünüm toplamı (`<k>:takvim|vadeTakip|projeksiyon:cariToplam:<cari>`) artık yazılır (S130 değer alanında, kartsız caride). `belirsiz` kayıtları:
"<k>: cari <ad> S130 görünümü tanımsız (2.5.0 §25): … KULLANICIYA SORULMALI SK-27 | SK-28 (a) | SK-28 (b) …", "… BİLİNEN SINIR (kullanıcı kararı S133 = C) S133 (§25 Y14-12)", "… BİLİNEN SINIR (kullanıcı kararı S134 =
C) S134 (§25 Y14-13)", SK-20 nedeninde "… S135 = C) S135 (§25 Y14-14)", SK-26 nedeninde "BİLİNEN SINIR (kullanıcı kararı S131 = C) SK-26".

### Eşleme notları (ana oturum için; `kos.mjs` bu bakımda DEĞİŞMEDİ, açılmadı)
- Yeni adım yok; d39 / d40 mevcut adım türleriyle (`cari_ac {acilis, acilisVade, tel}`, `fatura {taksit}`, `borc {vade}`, `alacak`, `tahsilat`, `odeme`, `stok_iade`, `stok_satis_hesap`, `supheli_al`, `degersiz`, `evrak {fatura}`,
  `kart_ac {mevcut}`, `kart_tahsilat`, `donem_kilitle`). `degersiz` adımında `cari` alanı YOK (kayıttan bulunur) — G1 sıralamasında sınır; `donem_kilitle` senaryonun bütün carilerine uygulanır (d40'ta yalnız Q6 / Q7
  net görünümlü).
- **Ana oturuma:** `model.py` değişti — mobil yazma kâhininin `cari_model_sha256`'sı yeniden üretilmeli (o dosya okunmadı); yapım aşaması listesi bu ajanca açılmadı (c7 `k3`'ün dört görünüm değeri, d39 / d40'ın yeni
  denetimleri ve S133 / S134 alanındaki programda varsa eski değerler listede DEĞİŞEN / YENİ / KAPANAN kayıt olarak görünebilir — ayrıştırma ana oturumda). Kâhinin dilinde kartın / taksitin DURUM anahtarı
  ("Tamamlandı" / "Ödendi · Kısmen · Bekliyor") yok — S129'un durum metni koşucuya ayrı anahtar olarak eklenmek istenirse kâhine ayrı bakım gerekir.

### C12r DENENMEYEN (bakım 14; neden)
- Program koşulmadı (görev). Programın S130 / S133 / S134 alanındaki gösterimi bilinmiyor (yalnız soru metinlerindeki örnekler).
- Şüpheliden GERİ ALMA (Şüpheliden Çıkar / karşılık) — kâhinin dilinde adım yok (§8 ŞÜPHELİ KALAN'dan beri DENENMEYEN).
- Şüpheli kayıtlı caride gecikmiş (SK-29), Ödeme Sözü taşıyan kalem, vadesi gelecekte (ufuk dışı) kalem, iki şirket / yedek geri yükleme, silinen / geri yüklenen şüpheli kaydı ya da tahsilatı (silme ↔ S130).
- S129'un durum metinleri ve tahsilat formunun sınırı (S118 = B) — anahtar yok. S133'ün "en son" sözünün yazım sırası ↔ belge tarihi ayrımı (kâhin belge tarihi → yazım sırasıyla en sonu alır; iki sıranın ayrıştığı
  senaryo yazılmadı). S134'ün K1 biçimi (yalnız mutant 245 dünyasında).
- S133 / S134'ün programdaki eski değerleriyle karşılaştırma (yapım aşaması listesi — ana oturumda).

### C0r Değişen eski beklentiler (G3; bakım 12 (`86531a4a` ağacı — çalışma dalı ucu) ↔ bakım 14 kâhin çıktısı, `2.5.0`; eski kopyanın 92 elle senaryosu + d39 / d40 + rastgele s1 / ux18 tohum 1–10 × 120) — kararla ilgisiz eski beklenti DEĞİŞMEDİ
Eski 48.957 → yeni 48.973 denetim; değişen / kalkan / yeni toplam **141**; **BEKLENMEYEN 0** (dökümü `docs/kanit/2026-11-11/kahineski14-g3-dokum-*.json` — iki saat diliminde bayt bayt aynı; özet
`kahineski14-esdeger-cari-*.log`). Sınıf, yeni modelin `s130` / `_alacak_govde250` / `net_durum` izinden cari cari:
- **c7-ks7-bagsiz-kapaticilar (S130-alan, 4 değişen — kararın örneği AYNEN):** `k3:takvim:hareket:acilis:D`, `k3:vadeTakip:hareket:acilis:D`, `k3:projeksiyon:hareket:acilis:D` 1.000 → 300;
  `k3:takvim:fatura:F1` 200 → "yok". Borç 500 (b1) kalemi, Kalan'lar, F1 açığı (200), bakiye (1.700) ve `k4`'ten sonraki bütün denetimler (Değersiz 900 sonrası — R = 0) AYNEN. Yalnız etiketi değişen 2
  (`k3:takvim|vadeTakip:hareket:b1` BAŞ MİMAR → KULLANICI — değer aynı).
- **d39 (dosya yeni, eski kâhinde de koşuldu): S130-alan 33 değişen + 59 yeni, S130-genel 2 değişen** (sayaçlar `cariKalemSayisi` / `projeksiyon:cari` — eski kâhin şüpheli kalemleri düşmeden sayıyordu);
  yeni 59 = şüpheli kayıtlı carilerin görünüm toplamı (`cariToplam` × 3 görünüm; bakım 12'de tanımsızdı). Etiketi değişen 3 (N10F, n1b ×2 — değer aynı).
- **d40 (dosya yeni): S130-sus 16 kalkan** (Q1 / Q1b / Q2 / Q3 / Q4 — eski kâhinin düşürmeden yazdığı kalem / fatura kalemi / sayaç değerleri), **S133-sus 13 kalkan** (Q5 — eski kâhin Y9-2 ile Kalan / takvim /
  kart ödeneni / gecikmiş yazıyordu = S133 B), **S134-sus 14 kalkan** (Q6 — eski kâhin S95'le kilitli netleşmeyi geri alıp Kalan / takvim / gecikmiş yazıyordu = S134 A). Q5b (Y9-2 aynen), Q7 (S95 aynen), Q8 (SK-20
  susması aynen) fark 0.
- **Öbür 91 eski elle senaryo ve 20 rastgele: fark 0** (rastgele üretici şüpheliyi aynı gün tamamen Değersiz yazdırıyor — R = 0; adımları değişen eski senaryo 0; S133 / S134 / S130 SUS alanı eski elle
  senaryolarda yok).
- **Eski ELLE tablolarda değişen beklentiler** (`kahineski14-elle-fark-*.log`; yalnız d38, S131 = C gereği): M14 / M15'in `elleBelirsiz` kaydına "BİLİNEN SINIR", "S131 = C" eklendi (2 kalktı + 2 eklendi).
  Öbür 91 dosyanın elle tablosu ve bütün dosyaların adımları AYNI (92/92).
- `--kural 2.4.9` / 2.4.6 / 2.4.5 / `--legacy`: **456/456 bayt bayt aynı** (92 eski elle + d39 / d40 + 20 rastgele × 4 kip); üretici 20/20 aynı dizi.
- **Yeni / değişen elle tablolar ESKİ (bakım 12) kâhinde — beklenen NEDENLE kırmızı (ders 7, 38):** 622 elle denetimin **108**'i (`kahineski14-kirmizi-eski-cari-*.log`; d39 74, d40 32, d38 2): 35'i değer
  farklı (eski kâhin kalemleri düşürmüyor — S130 B), 39'u "ANAHTAR YOK" (şüpheli carinin görünüm toplamı eski kâhinde tanımsız), 24'ü eski kâhinin SUS alanında değer yazması (Q1 … Q6), 10'u `belirsiz`
  kaydı yok (S130 SUS, S133, S134, S135, S131 metinleri); 514'ü iki kâhinde aynı (bakiyeler, Kalan'lar, fatura açıkları, S129 kart göstergeleri — P1 / P2 / P3 — eski kâhinde de aynı: S129 onayı).

### Kanıt (bakım 14; iki saat dilimi — UTC ve Europe/Istanbul çıktıları bayt bayt aynı (başlık satırları dışında); kâhin `1aa3ec9f`, temiz ağaç; `docs/kanit/2026-11-11/kahineski14-*`, araçlar ve koşu betiği `docs/kanit/2026-11-12/kahineski14-arac/`)
cari öz test **5.976/5.976** (`-cari-oz-*`: elle tablolar 94 senaryo, mutantlar 200–285 — 219–285 değerle) · mutasyon taraması **252/252** (`-cari-mutasyon-*`) · eşdeğerlik + G3 **569/569** (`-esdeger-cari-*`) ·
yeni / değişen elle tablo **622/622** (`-elle-yeni-cari-*`: d39 234 + d40 94 + d38 294) · ESKİ kâhinde **108 kırmızı** / 622 (`-kirmizi-eski-cari-*`) · eski elle tablo farkı **92/92** izinli (`-elle-fark-*`) · G1 tarama
**94/94** (`-g1-tara-*`) · mutant ↔ senaryo **150/150** (`-mutant-senaryo-*`; d35 … d40 × 261–285) · geniş tarama **2.201/2.201** (`-genis-tarama-*`; bakım 12 ile aynı sayı) · defter öz testi **181/181**
(`-defter-oz-*`; bakım 9–12'deki AttributeError bu tabanda yok — bu bakım defter kâhinine dokunmadı). Öz test, mutasyon, eşdeğerlik ve geniş tarama `flock -s -n …/olcum.lock` ile (ders 52). Program açılmadı.
Koşu günlükleri `kahineski14-kos-utc.txt` / `-ist.txt` (yük 1,3 / 2,3 — 4 çekirdek).

## 26. 2.5.0 Ç5 bakımı 15 — TOPLU: S136 / S139 / S140 / S145 / S151 (yeni kurallar) + S142 / S148 / S150 (beklentinin onayı / alan) + S137 / S138 / S141 / S143 / S144 / S147 / S149 = C (BİLİNEN SINIR) (13.11.2026, `date -u` 07:40; kararlar 12.11.2026 23:44 UTC, 13.11.2026 03:44 UTC ve 13.11.2026 — ana oturumun özet dosyası; eski kâhinler bakımı 15 — kodu görmeyen AYRI el; TOPLU KÂHİN BAKIMI) — kural seti `2.5.0` = §13 + … + §25 + bu bölüm

Bu bakım bakım 14'ün TOPLU sorularının ve ardından gelen küçük soruların TOPLU bakımıdır: beş yeni kural (S136, S139, S140, S145, S151 — kâhin bu alanlarda bugün susuyor ya da başka değer
yazıyor), üç onay / alan notu (S142, S148, S150) ve yedi BİLİNEN SINIR (S137 / S138 / S141 / S143 / S144 / S147 / S149 = C — kâhin o alt durumlarda SUSAR, kural yok). S110, S120, S122, S126, S128,
S129, S130 (bu bölümün S136 / S139 genişletmesi dışında), S2, S50, S95, S99, S101 ve §13–§25'in öbür kuralları DEĞİŞMEZ. `--kural 2.4.9` (ve 2.4.6 / 2.4.5 / `--legacy`) AYNEN. Defter kâhini
(`test/bagimsiz/defter/`) DEĞİŞMEZ (S136 / S139 / S140 / S151 bakiyeyi ve yevmiyeyi değiştirmez; S145'in reddi yevmiye yazmaz; S147'nin açılış adayı cari kâhininde yok — defter kâhinine dokunulmadı).
**Bu bölümün ilk commit'i yalnız YORUMDUR (ders 40 — önce kural, sonra kod); senaryo / mutant / G3 sayıları kod ve kanıt commit'lerinde eklenir.**

### C00s Temiz oda (bakım 15)
- **Girdi (tek kaynak; ana oturumun özet dosyası `scratchpad/kahin-eski15-kararlar.md` — "programın hesap / görünüm davranışı hakkında bilgi içermez"; soru metinleri kullanıcıya gösterildiği gibi AYNEN;
  KURAL KAYNAĞI yalnız KARAR satırlarıdır — soru metnindeki "program bugün" sözü beklenti kaynağı sayılmadı):**
  - S136 KARAR (12.11 23:44, AYNEN): "S136 = A — şüpheliye alınan tutar türüne bakmadan kuyruk sırasıyla düşer; TAKSİT kalemlerinden ve verilen avans kaleminden de (kart penceresinin göstergeleri
    değişmez)." Soru örneği: "Borç 400 → taksit kartı 400 (2 × 200) → fatura F 600 → Şüpheli Alacağa Al 300; bakiye 1.000. A … → takvimde 1. taksit yok, F 500, 2. taksit 200 (gecikmiş 700; kart
    penceresinin göstergeleri değişmez)." NOT (1): örnek sayıları AYNEN; "kuyruk sırası" bakım 14'te S130 için yazılan okumayla AYNI olmalı.
  - S139 KARAR (12.11 23:44, AYNEN): "S139 = A — şüpheli kaydı olan caride GECİKMİŞ tutar görünen kalemlerden (cari kartı = Cari Listesi = Vade Takip = zil aynı sayı)." Örnek: "fatura 200 + Borç
    1.000 + Borç 500 (hepsi vadesi geçmiş) → Şüpheli 900; bakiye 1.700. A … → gecikmiş 800."
  - S140 KARAR (12.11 23:44, AYNEN): "S140 = A — stoktan taksitli satışla açılan kart iadeyle küçülünce KENDİ satışını taşır (S110 = A'nın devamı): örnekte taksit kalanları [0, 200], gecikmiş 0,
    elle borç kendi vadesinde ayrı." Örnek: "elle Borç 500 (vadesi ileride) + stoktan taksitli satış 1.000 (taksitler 500 vadesi geçmiş + 500 ileride) → faturasız stok iadesi 800; bakiye 700."
  - S145 KARAR (13.11 03:44, AYNEN): "S145 = A — şüpheliye alma tarihinden ÖNCEKİ tarihe tahsilat REDDEDİLİR (o tarihte şüpheliye alınan tutar carinin borcunu aşardı); bugün tarihli / şüpheli
    tarihinden sonraki tahsilat kabul edilir (soru metnindeki örnek: borç 1.000, şüpheli 900 → tahsilat 300: bakiye 700, açık şüpheli 900 → 600)." Soru örneği: "borç 1.000 → 30 gün önce şüpheli 900 →
    40 gün önceye tahsilat 300." NOT (3): reddin KOŞULU "o tarihte şüpheli tutar borcu aşıyorsa"; sınırı (tam eşitlik; aynı gün; kısmi) tek biçimde çıkmıyorsa o sınırda SUS.
  - S151 KARAR (13.11, AYNEN): "S151 = B — taksit kartının 'Tahsil Edilen'i ve taksit satırının 'Ödenen'i FATURASIZ stok iadesini SAYMAZ (iade tahsilat değildir): örnekte 'Tahsil Edilen 0', 'Kalan' yine
    700, bakiye 1.200; iade ayrı gösterilir. İade faturasıyla yapılan iadede kart küçülür, Tahsil Edilen 0." Örnek: "Borç 500 + stoktan satış kartı 1.000 (2 × 500) + faturasız stok iadesi 300." NOT (1):
    'Kalan', bakiye, gecikmiş ve takvim kalemleri bu karardan ETKİLENMEZ; "ayrı gösterilir"in gösterim alanı için değer YAZILMAZ; iade + iade geri ödemesi ve satış kartı olmayan caride iade → SUS ve sor.
  - S142 KARAR (13.11 03:44, AYNEN): "S142 = A — cari kartındaki taksit kartı satırında durum etiketi ve 'sıradaki taksit' de aynı (tek) hesaptan (S129 = A'nın devamı)." NOT (4): alan yoksa "alan yok".
  - S148 KARAR (13.11, AYNEN): "S148 = A — Nakit Akışı'nda vadesi geçmiş, sözü ileride borç söz gününde 'beklenen giriş' olarak kalır; gecikmişlere eklenmez (tek kez sayılır)." Örnek: "borç 100, vadesi
    10 gün önce, söz 15 gün sonra".
  - S150 KARAR (13.11, AYNEN): "S150 = A — Vade Takip'in 'Gecikmiş' hazır aralığı durumu Gecikmiş olan HER kalemi gösterir (sözü bugün ya da ileride olan gecikmiş borç dahil); 'Gecikmiş Tahsilat'
    göstergesi her aralıkta aynı sayı (örnekte 850 TL / 4 kalem)."
  - S137 / S138 / S141 (12.11 23:44) ve S143 / S144 / S147 (13.11 03:44) ve S149 (13.11) = C — BİLİNEN SINIR (soru metinleri girdi dosyasında AYNEN; özetleri yorumlarda). NOT: "bu altı alt durumda
    kâhinin bugün bir DEĞER verip vermediğine bak. Değer veriyorsa ve o değer sorularda yazan okumalardan birine dayanıyorsa, o alt durumda (yalnız ayrışan alanlarda — bakiye okumalar arasında aynıysa
    bakiye beklenir) SUS'a çevir … S147 … cari kâhininde karşılığı yoksa 'alan yok' … Kararların kapsadığı ana durumlar … AYNEN değer vermeye devam eder." S149 NOT (3): "iki görünümün (takvim tarafı ↔
    cari tarafı) ayrıştığı alanlarda SUS."
- **Birlikte okunan (kâhinin kendi belgesi):** bu dosyanın §8 C6 (S1, K6.3, K6.5, KS7, ŞÜPHELİ KALAN, KS2), §13 C13.4 (1)–(11) / C13.5 / C13.6, §14 C14.2, §15 C15.1 / C15.2, §16 C16.1–C16.4, §17 (S96),
  §19 Y7-2 / Y7-3, §20 (S110 — Y8-1 … Y8-6), §25 (bütünü); `model.py` şüpheli (`_supheli_hesap`, `supheli_al`, `s130`), kuyruk (`_tyk`, `_alacak_govde250`, `_alacak_tarafi_250`), kart (`kart_odenen`,
  `stok_satis_taksit`), gecikmiş (`_gecikmis_brut`, `gecikmis250`), görünüm (`kontrol_v3`, `_cari_kalemleri`, `_belirsiz_uyeler`), `kontrol`, `kos`; c7 / c7b / d39 / d40 elle senaryoları;
  `docs/kanit/2026-11-12/kahineski14-arac/` araçları. Okunan / okunmayan dosyaların tam listesi (satır aralıklarıyla) ajan raporunda.
- **Okunmayan:** `server/**`, `client/**`, `bulut/**`, `packaging/**`, `tools/**` (yalnız `kanit.mjs` çalıştırılır), `docs/erp/C5-ACILIS-TASARIM.md`, `docs/erp/C5B-TYK-TASARIM.md`, `docs/devir/**`,
  `docs/2.5.0-IS-LISTESI*.md` (hiçbir sürümü), `test/bagimsiz/cari/YAPIM-ASAMASI.json`, `kos.mjs`, iki kâhin klasörü dışındaki `test/**`, başka ajanların `docs/kanit/**` dosyaları (yalnız
  `kahineski14-arac/` araçları), git farkı / geçmiş içeriği. Program koşulmadı; programın davranışı aranmadı. CLAUDE.md "Açık iş"teki program durumu kural / beklenti kaynağı sayılmadı.

### Kâhinin BUGÜNKÜ (bakım 14, çalışma dalı `bafd9aaf`) okuması — on beş kararın alanında (açıkça)
- **S136:** SUSUYOR — §25 Y14-6 (a) SK-27: R > 0 iken carinin etkin taksit kartı / taksitli satış faturası / verilen avansı (Ödeme / ciro) varsa S130 görünümü (takvim / Vade Takip / projeksiyon
  kalemleri, sayaç, görünüm toplamı) yazılmıyor; kart göstergeleri, Kalan, fatura açığı, bakiye yazılıyor. Kararın örneği d40 Q3'tür (bakım 14 SK-27'nin kendi örneği; bugün 15.06). B'nin değeri hiç yazılmıyor.
- **S139:** SUSUYOR — C13.5 ("şüpheli kaydı olan cari tanımsız") → `cari:<ad>:gecikmis` şüpheli kayıtlı caride hiç yazılmıyor (d39 / d40 `elleYok`). Ne A ne B.
- **S140:** DEĞER veriyor ama A'ya dayanmıyor: kart açıldıktan sonraki faturasız stok iadesi KS7 (a) bağsız kapatıcıdır ve S2 kuyruk sırasıyla (vade → belge → yazım) dağılır (§20 Y8-5) — elle borcun vadesi
  2. taksitten önceyse iadenin artanı elle borca düşer (ne A ne B; A ile ancak elle borcun vadesi 2. taksitten SONRAYSA aynı sonuç). Kart göstergeleri iadenin payını 'ödenen' sayıyor (S151'in A'sı).
- **S145:** DEĞER veriyor = B: `tahsilat` adımı her durumda kabul; şüpheli kalan ŞÜPHELİ KALAN ile (kayıttan önce tarihli satır düşmez) → R kalemlerin toplamını aşabiliyor (§25 Y14-4 "bütün kalemler 0").
  d39 N11 (04.06 tarihli 300 tahsilat, 05.06 şüpheli 500, borç 500) tam bu durum ve kabul bekliyordu.
- **S151:** DEĞER veriyor = A: `kart:<no>:odenen` / `taksit<i>:odenen` = taksitlerin TYK'de kapanan toplamı, faturasız stok iadesinin kapattığı kısım dahil (Y14-10).
- **S142:** alan yok — kâhinin dilinde kartın / taksitin DURUM anahtarı ve "sıradaki taksit" yok (Y14-10). Beklenti değişmez.
- **S148:** DEĞER = A: projeksiyon kalemi tarih = Beklenen Ödeme Tarihi varsa o (KS10) — sözü ileride kalem söz gününde, bir kez; "gecikmişleri başlangıca ekle" seçeneği kâhinde yok.
- **S150:** alan yok — Vade Takip denetimi kalem başına (`vadeTakip:hareket`, bugün + 6'ya kadar) ve görünüm toplamı; hazır aralık ve "Gecikmiş Tahsilat" göstergesi yok.
- **S137:** SUSUYOR — SK-28 (a) (iki zaman okuması ayrışıyor); neden "KULLANICIYA SORULMALI".
- **S138:** SUSUYOR — SK-28 (b) (şüpheliden düşen bağlı çek / iade faturası); neden "KULLANICIYA SORULMALI".
- **S141:** DEĞER veriyor = A: kart tahsilatının fazlası ("kartfazla", C13.4 (3)) bağsız alacaktır ve kuyruğun en eski kalemini kapatır; faturanın belge açığı aynı kuyruktan → fatura listesi kuyrukla aynı.
- **S143:** (a) DEĞER veriyor = C: karşı yönlü kalemli kartlı caride kart göstergeleri yazılıyor (C16.2 / Y8-6 "belge durumu, bakiye, kart yazılır") — Kalan = tutar − kuyruk ödeneni (Alacak Yaz kartı
  kapatmaz — KS2) = 900. (b) alan yok — kâhinin kartı her zaman eşit taksitlere tam bölünür (`kart_ac` [YAYGIN]).
- **S144:** (c) DEĞER veriyor = A: kart ödeneni TYK (fazlası bağsız) = 1.000. (d) alan yok — "Kartı Kapat" kâhinin dilinde yok (C12f). (e) "güvenli kapanış" kâhinde yok (kâhinin kuyruğu her zaman
  baştan kurulur) — tetiği tanımlanamaz → DENENMEYEN.
- **S147:** alan yok — cari kâhininde "Açılış Olabilir" adayı ve onayı yok (açılış satırı silinemez — `hareket_sil` açılışı reddeder).
- **S149:** DEĞER veriyor = C: takvim kalemi K6.3 (söz geçmiş, vade bugün / ileride → durum overdue, gün sayısı SÖZDEN — C15.2 "Beklenen ≤ vade ve vade ≥ bugün K6.3 aynen") ve carinin gecikmişi
  C13.5 / C16.4 (vade < bugün değil → sayılmaz).

### Yorumlar (ders 40 — kararlardan; kod yazılmadan ÖNCE; baş mimar kullanıcıya gösterir)
- **Y15-1 — S136: alan ve kural (Y14-2 / Y14-4'ün genişletilmesi):** R (şüpheli kalan — Y14-3 aynen) carinin BÜTÜN 'Tahsil Edilecek' kalemlerine tek yükümlülük kuyruğunun sırasıyla (vade → belge →
  yazım — Y14-2, bakım 14'te S130 için yazılan okuma AYNEN), en eskiden, birikimli düşer; türüne bakılmaz: taksitsiz satış faturası, elle Borç, borçlu Açılış, stok veresiye satışı, karşılıksız borç
  kalemi (bakım 14'te de), **taksit kartlarının taksitleri** (Taksitler'den Mevcut Borç / Yeni Borç kartı, Tablodan Aktar kartı, satışla açılan kart — taksitin vadesi taksit tarihi, belge günü kartın günü),
  **taksitli satış faturasının taksitleri** (S99) ve **verilen avans kalemi** (S96 — Ödeme / ciro; vadesi = belge günü = ödeme günü, yazım sırası ödemenin sırası). Kartın tükettiği kalem kuyrukta 0
  (M1e) — R'den pay almaz. **Kuyruk sırası ↔ S130 okuması (NOT (1)): bağdaşıyor.** Kararın örneği bakım 14 SK-27'nin örneğidir (d40 Q3: 01.04 Borç X 400 · 15.04 kart 400 (01.05, 01.06) · 10.05
  F 600 · 20.05 Şüpheli 300): kuyruk 1. taksit (v 01.05) → F (v 10.05, vadesiz = belge günü) → 2. taksit (v 01.06); R 300 ⇒ 1. taksit 0, F 500, 2. taksit 200 — sorunun A satırıyla AYNI; belge tarihi
  sırası (X 01.04 → kart 15.04 → F 10.05 — taksitlerin belge günü 15.04) da 1. taksit → 2. taksit → F verirdi (1. taksit 0, 2. taksit 100, F 600) — örnekle BAĞDAŞMIYOR (Y14-2 / mutant 285 ile aynı
  ayrım). "Gecikmiş 700": bugün iki taksitin ve F'nin vadesinden sonra (d40'ın bugünü 15.06) — S139 ile görünen kalemlerden 0 + 500 + 200 = 700. **Değişmeyen (karar: "kart penceresinin göstergeleri
  değişmez"):** kart:<no>:odenen / kalan / taksit<i>:odenen (kuyruk — R düşmez), Kalan, fatura açığı, bakiye. **Kâhinin anahtarları:** taksit kaleminin takvim / Vade Takip tutarı kâhinin dilinde YOK
  (kâhin kart taksitini kalem kalem yazmaz — K6.5'ten beri); S110 / S126 alanı dışındaki kartlı caride fatura kaleminin takvim tutarı da K6.5 sınırıyla yazılmıyor (değişmedi) → örneğin "1. taksit yok,
  F 500, 2. taksit 200"ü kâhin GECİKMİŞTE (700) ve S110 alanındaki / kartsız taksitli faturalı caride elle kalemlerin görünen tutarında denetler; kartsız taksitli faturalı caride görünüm toplamı
  K6.5 sınırıyla yazılmaz (değişmedi). Etiket: değişen her görünüm / gecikmiş denetimi KULLANICI (S136 A).
- **Y15-2 — S136 × verilen avans ve zaman (Y14-5'in iki okuması):** Ödeme avansının görünen tutarı (`takvim | vadeTakip | projeksiyon:hareket:<ödeme>`) = avans − R'nin o kaleme düşen payı. Ciro avansının
  kalem kimliği yok (SK-7 — belirsiz üye): R sırasında yer alır, kendi çıktısı yok. **İki zaman okuması (O1 kontrol anı ↔ O2 şüphelinin günü):** avanssız caride bakım 14'teki gibi iki okuma ayrı
  hesaplanır (O2: Şüpheli Alacağa Al kendi gününde bağsız kapatıcı — kart tüketimi ve S101 (R1 / R2) ana hesapla AYNI düzenle; bakım 14'te O2 S101'siz koşuyordu, kartlı cari o zaman SUS'ta
  olduğundan fark yoktu); ayrışırsa SUS (S137 = C — Y15-10). Avanslı caride O2 kâhinin tek taraflı kuyruğunda kurulmuyor (avans borç tarafının artanı) → Y14-5'in kendi ilkesi uygulanır: carinin bütün
  kalemleri ve avans ilk şüpheli kaydından ÖNCE doğduysa (gün → yazım) iki okuma AYNIDIR → DEĞER; değilse SUS (S137 ailesi — BİLİNEN SINIR). Avanslı caride borç tarafında açık yükümlülük satırı (iade
  notu — KS8) varsa avansın tutarı zaman içinde değişir → SUS (kâhinin sınırı; neden metni). Verilen avans + sonra bağsız alacak yönlü satır (Y5-7) → net görünüm tanımsız AYNEN.
- **Y15-3 — S136 × kart ve şüpheliden düşen kart tahsilatı:** kart ŞÜPHELİDEN ÖNCE açıldıysa taksitleri o gün doğmuş kalemlerdir → DEĞER (iki okuma yukarıdaki gibi). Kart şüpheliden SONRA açıldıysa
  taksitler sonradan doğan kalemdir (kart tüketimi şüphelinin O2 gününde kapanmış kalemi tüketemez) → iki okuma ayrışırsa SUS (S137 = C). Şüpheli tarihinden sonra (aynı gün dahil) karta girilen
  **Taksit Tahsilatı** hem şüpheliden düşer (ŞÜPHELİ KALAN "taksit tahsilatı") hem taksiti bağla kapatır (C13.4 (3)) — S138'in sorusuyla aynı yapı (bağlı ödeme şüpheliden düşüyor), ama kararın metni
  "o faturaya BAĞLI tahsilat (çek / iade faturası / bağlı ödeme)" — taksite bağlı tahsilatı adıyla saymıyor → **SK-30** (SUS; KULLANICIYA SORULMALI). Şüpheliden ÖNCE tarihli Taksit Tahsilatı şüpheliden
  düşmez → DEĞER.
- **Y15-4 — S139: kural:** şüpheli kayıtlı caride `cari:<ad>:gecikmis` = Σ görünen kalem {vade < bugün} + Σ görünen verilen avans {ödeme günü < bugün} — C16.4'ün yalın olmayan kolu aynen, kuyruk kalanı
  yerine GÖRÜNEN tutarla (Y14-4 / Y15-1); tanım koşulları C16.4 AYNEN (karşı yönlü yükümlülük kalemi yok, S98 tek taraflı kuyrukta kurulabiliyor, kuyruk toplamı = bakiye). R = 0 → C16.4 aynen.
  S130 görünümü SUS ise (S137 / S138 / SK-30 / Y15-2) gecikmiş de YAZILMAZ (görünen kalemler tanımsız). "cari kartı = Cari Listesi = Vade Takip = zil aynı sayı" → kâhinde tek anahtar. Görünen ≤
  kuyruk olduğundan EK-1 §1 (i) 0 ≤ gecikmiş ≤ max(0, bakiye) korunur. Kararın örneği d39 N1 (bugün 15.06; F1 0, Açılış 300, Borç 500 — hepsinin vadesi geçmiş) ⇒ 800. Etiket KULLANICI.
- **Y15-5 — S140: alan ve kural:** stoktan taksitli satışla açılan kart (`stok_satis_taksit`) açıldıktan SONRA (gün → yazım sırası) gelen faturasız stok Satış İadesi önce o kartın açık taksitlerini
  kapatır — taksit sırasıyla (vade → yazım; kararın örneği [0, 200]: önce 1. taksit); carinin öbür borçları (elle Borç / Açılış / karşılıksız) kendi kalanıyla ayrı kalır ("kart KENDİ satışını taşır" —
  S110 = A'nın devamı, Y8-2). Kararın örneği AYNEN: elle Borç 500 (vade ileride) + satış 1.000 (2 × 500: 1. taksit vadesi geçmiş, 2. taksit ileride) → iade 800 ⇒ taksit kalanları 0 / 200, gecikmiş
  0, elle Borç Kalan 500 (kendi vadesinde kalem), bakiye 700; kart 'Kalan' 200 (S151 ile 'Tahsil Edilen' 0, taksit 'Ödenen' 0 / 0). **Tek okuma alanı (DEĞER):** carinin TEK etkin satış kartı; carinin
  başka SATIŞI yok (satış faturası — taksitli / taksitsiz —, kartın kendi satışı dışında stok veresiye satışı); iadenin geri ödemesi yok (KS8 — `_geri_odemeler`); iade ≤ kartın o andaki açık
  taksitleri. **SUS (SK-31; C13.4 (11) düzeninde cari tanımsız — bakiye, kart tutarı yazılır):** (a) iade kartın açığından BÜYÜK (artanın yeri kararda yok); (b) birden çok satış kartı ya da başka
  satış (iade hangi satışın); (c) iadenin geri ödemesi. Kart açılmadan önceki iade: Y7-2 (3) aynen (EK-2B 32 tanımsız). Satış kartı olmayan caride faturasız stok iadesi: KS7 (a) / S2 AYNEN (değişmedi).
  Bakiye, yevmiye DEĞİŞMEZ. Etiket KULLANICI.
- **Y15-6 — S145: kural (NOT (3)'ün koşulu) ve sınırı:** kabul edilecek her TAHSİLAT adımı (`tahsilat` — bağsız ya da faturaya bağlı, nakit ya da havale — ve `kart_tahsilat` Taksit Tahsilatı; kararın sözü
  "tahsilat") tarihi carinin bir Şüpheli Alacak kaydının tarihinden ÖNCEYSE (aynı gün değil), o kaydın gününde K1 (ŞÜPHELİ KALAN "Şüpheli Alacağa Al tutarı ≤ cari borç bakiyesi − açık kayıtların kalanı")
  tahsilatla birlikte yeniden kurulur; bozuluyorsa ("o tarihte şüpheliye alınan tutar carinin borcunu aşardı") adım REDDEDİLİR — hiçbir satır yazılmaz, Kasa, bakiye, şüpheli kalan değişmez,
  `adim:<id>:durum` "ret" (ret iletisi / kodu yazılmaz — karar yalnız "anlaşılır ileti" diyor, metni / kodu verilmedi). **O tarihteki borç:** kaydın gününden önceki günlerin bütün hareketleri (açılış,
  elle Borç / Alacak, fatura, iade, stok, Ödeme, ciro, tahsilat, evrak, karşılıksız, Yeni Borç kartı) + o günün borç yönlü kalemleri; o günün alacak satırları ve Değersiz'i kayıttan SONRADIR (ŞÜPHELİ
  KALAN aynı gün sırası al → değersiz → alacak). "O anda açık öbür kayıtların kalanı": ŞÜPHELİ KALAN'ın zaman çizelgesi o kaydın alınışına kadar. **Sınırlar (tek okuma):** tam eşitlik KABUL
  ("aşardı" kesin büyüklük; K1'in ≤'ü); aynı gün KABUL ("ÖNCEKİ tarihe" değil; aynı gün tahsilat önce şüpheliden düşer — aşım doğmaz); öncesi ama borç yetiyor KABUL (koşul bozulmuyor); kısmen aşan
  (tahsilatın bir kısmı borcu aşırıyor) → BÜTÜN adım RET (kâhinin dilinde kısmi kabul yok; adım bölünmez); kayıt sonradan Değersiz yazılmış / tahsil edilmiş olsa da koşul O TARİHTE kurulur (kararın
  sözü "o tarihte"). Bugün tarihli / şüpheli tarihinden sonraki tahsilat KABUL (ŞÜPHELİ KALAN aynen — kararın örneği: borç 1.000, şüpheli 900 → tahsilat 300: bakiye 700, şüpheli kalan 600). **SUS:**
  (SK-33) tahsilat DIŞINDAKİ bir adım (alınan çek / senet, elle Alacak, faturasız stok iadesi, iade faturası, borç kaydının silinmesi / düzeltilmesi, faturanın iptali / silinmesi, Silinenler'den geri
  yükleme …) o tarihte aynı aşımı doğuruyorsa kâhin adımın kabul / reddini bilmez → iki dünya (adım kabul ↔ adım yok), farklı çıkan denetimler yazılmaz (bakım 7 SK-18 düzeni — `belirsiz` kaydıyla);
  (SK-34 (a)) aşım tahsilattan ÖNCE zaten varsa (kâhinin K1'i adım anındaki bakiyeyle — sonradan tarihli borç sayılmış) ya da (SK-34 (b)) o günün borç yönlü kalemlerinin kayıttan önce / sonra sayılması
  kararı değiştiriyorsa → tahsilat adımı da aynı iki dünya düzeninde SUS. **d39 N11** (bakım 14 "şüpheli kalan kalemleri aşar": borç 500 (01.06) · şüpheli 500 (05.06) · 04.06 tarihli tahsilat 300 —
  o tarihte borç 200 < 500) S145'in örneğidir → artık RET: bakiye 500, Kasa'da 300 yok, kalem 0 (R 500 = borç 500), görünüm toplamı 0, gecikmiş 0. Y14-4'ün "R kalemlerin toplamını aşarsa 0" kolu
  tahsilatla artık oluşmaz (yalnız SK-33 / SK-34 dünyalarında — orada zaten SUS); kural metni durur. Mizan, yevmiye: ret yazmaz. Etiket KULLANICI.
- **Y15-7 — S151: kural:** kartın 'Tahsil Edilen'i (`kart:<no>:odenen`) ve taksit satırının 'Ödenen'i (`kart:<no>:taksit<i>:odenen`) taksitin TYK'de kapanan kısmından faturasız stok iadesinin
  kapattığı kısım ÇIKARILARAK; 'Kalan' (`kart:<no>:kalan`) = tutar − (ödenen + iadenin kapattığı) — DEĞİŞMEZ ("Kalan yine 700"). DEĞER alanı satış kartı (Y15-5 alanı): kararın örneği AYNEN (Borç 500
  + satış kartı 1.000 (2 × 500) + iade 300 ⇒ ödenen 0, kalan 700, taksit ödenenleri 0 / 0, bakiye 1.200). "İade ayrı gösterilir" — gösterim anahtarı YOK (eklenmedi). **SUS (SK-32):** satış kartı
  OLMAYAN kartın (Taksitler'den Mevcut Borç / Yeni Borç kartı, Tablodan Aktar kartı) taksitini S2 sırasıyla faturasız stok iadesi, iade faturasının artanı ya da Değersiz Alacak Yaz (para dışı bağsız
  kapatıcılar) kapattıysa o kartın `odenen` / `taksit<i>:odenen` denetimleri yazılmaz (S129 "tek kuyruk" ↔ S151 "iade tahsilat değildir" iki okuma); `kalan` yazılır. İade + iade geri ödemesi → SK-31 (c).
  "İade faturasıyla yapılan iadede kart küçülür": satış kartının faturası yok (iade faturası kâhinin dilinde asıl faturaya bağlı) — taksitli faturanın iadesi C13.4 (11) tanımsız AYNEN.
- **Y15-8 — S142 (onay; NOT (4)):** alan yok — kâhinin dilinde kartın / taksitin DURUM anahtarı ("1 taksit gecikti") ve "sıradaki taksit" YOK; S129'un tek kuyruk değerleri (Y14-10) DEĞİŞMEZ; eklenmedi
  (ana oturuma: gerekirse koşucuya ayrı anahtar — ayrı bakım).
- **Y15-9 — S148 (onay; NOT (2)):** kâhinin projeksiyon kalemi (KS10) tarih = Beklenen Ödeme Tarihi varsa o → vadesi geçmiş, sözü ileride borç söz gününde 'beklenen giriş', BİR kez (görünüm toplamı
  `projeksiyon:cariToplam` çift sayımı yakalar); kâhinde "gecikmişleri başlangıca ekle" seçeneği yok (alan yok) → beklenti DEĞİŞMEZ. Kararın örneği elle senaryo olarak eklenir (borç 100, vade bugün − 10,
  söz bugün + 15 ⇒ projeksiyon kalemi 100, söz gününde; takvim / zil kalemi söz gününde → 7 günlük ufkun dışında "yok"; carinin gecikmişi 100 — S52); etiket KULLANICI (S148 A).
- **Y15-10 — S137 = C:** SK-28 (a) SUS AYNEN; neden "… BİLİNEN SINIR (kullanıcı kararı S137 = C) S137 (§26 Y15-10)" (KULLANICIYA SORULMALI değil). Alan S136 ile genişler: kartlı / taksitli faturalı /
  avanslı caride de sonradan doğan kalem (kart şüpheliden sonra açıldı; avans şüpheliden sonra doğdu) aynı SUS'tur. Gecikmiş de yazılmaz (Y15-4).
- **Y15-11 — S138 = C:** SK-28 (b) (şüpheliden düşen FATURAYA bağlı çek / senet, iade faturası) SUS AYNEN; neden "… BİLİNEN SINIR (kullanıcı kararı S138 = C) S138 (§26 Y15-11)". Elle Alacak (h) zaten
  C16.2 tanımsız (karşı yönlü kalem) — aynı kayıtta. Taksite bağlı tahsilat SK-30 (Y15-3).
- **Y15-12 — S141 = C — DEĞER'den SUS'a:** kart tahsilatının kendi kartının açığını aşan kısmı (C13.4 (3) "kartfazla" — 'Taksit kartından artan ödeme') olan caride satış faturalarının BELGE açığı
  (`fatura:<ad>:acik`) ve açık toplamı (`cari:<ad>:acikToplam`, `acikEsitBakiye`) YAZILMAZ (fatura listesi ↔ kuyruk iki okuma). Takvim / Vade Takip / projeksiyon kalemleri (kuyruk) iki okumada aynı →
  yazılır; bakiye yazılır.
- **Y15-13 — S143 = C:** (a) karşı yönlü yükümlülük kalemli (C16.2 `_capraz250`) kartlı caride `kart:<no>:kalan` YAZILMAZ ('Mahsup Edilen' / tek hesap Kalan ↔ kartın kendi Kalan'ı); toplam, ödenen, taksit
  ödenenleri yazılır. (b) alan yok.
- **Y15-14 — S144 = C:** (c) kartın KENDİ tahsilatının fazlası (kartfazla) olan kartta `kart:<no>:odenen` YAZILMAZ ('Tahsil Edilen 1.100' ↔ tek kuyruk 1.000); kalan (0) ve taksit ödenenleri yazılır.
  (d) alan yok. (e) DENENMEYEN.
- **Y15-15 — S147 = C:** alan yok (cari kâhininde açılış adayı / onayı yok; defter kâhinine dokunulmadı).
- **Y15-16 — S149 = C — DEĞER'den SUS'a:** alan: açık elle kayıt (borç yönlü, görünen tutarı > 0), Vade Tarihi BUGÜN ya da ileride, Beklenen Ödeme Tarihi bugünden ÖNCE. Takvim / zil kalemi
  (`takvim:hareket:<ad>` — durum / gün sayısı: A ve C "Gecikmiş, sözden" ↔ B vade gelene kadar gecikmiş değil) ve carinin gecikmişi (`cari:<ad>:gecikmis` — C ve B 0 ↔ A sözden) YAZILMAZ; Vade Takip /
  projeksiyon kalemi (tutar, tarih, yön — durum taşımaz), Kalan, sayaç, bakiye yazılır. Söz günü (Beklenen = bugün) ya da söz ileride: K6.3 / C15.2 aynen (ayrışma yok). Alacak yönlü (Ödenecek Borç)
  kalemde cari gecikmişi zaten borç yönlü (S149 "borç"): takvim kalemi aynı SUS.
- **Y15-17 — DEĞİŞMEYEN:** şüphelisiz, satış kartı iadesiz, kart fazlasız, S149 alanı dışındaki carilerin bütün denetimleri; S129 (S151'in iade payı dışında), S130'un bakım 14 değer alanı (kartsız,
  avanssız — aynen), S110 / S120 / S122 / S126 / S128, S95 / S96 / S98, C13.5 / C16.4 (şüphelisiz), `--kural 2.4.9` ve öncesi.

### On beş kararın alt durumları (açıkça)
| Alt durum | Bakım 14 | Bakım 15 |
|---|---|---|
| S136: taksit kartı / taksitli fatura / verilen avans, bütün kalemler şüpheliden önce doğmuş | SUS (SK-27) | **DEĞER** (Y15-1 / Y15-2) |
| S136: kart / avans / kalem şüpheliden SONRA doğdu (iki okuma ayrışıyor) | SUS (SK-27) | SUS — BİLİNEN SINIR (S137 = C) |
| S136: şüpheli tarihinden sonra Taksit Tahsilatı | SUS (SK-27) | SUS — KULLANICIYA SORULMALI SK-30 |
| S136: avanslı caride açık iade notu (borç tarafı yükümlülüğü) | SUS (SK-27) | SUS — kâhinin sınırı (Y15-2) |
| S139: şüpheli kayıtlı caride gecikmiş (görünüm değer alanında) | SUS (C13.5) | **DEĞER** (Y15-4) |
| S139: görünüm SUS (S137 / S138 / SK-30) | SUS | SUS (aynen) |
| S140: satış kartı + sonra faturasız stok iadesi ≤ kartın açığı, tek satış | DEĞER (S2 — ne A ne B) | **DEĞER = A** (Y15-5) |
| S140: iade kartın açığından büyük / başka satış / iade geri ödemesi | DEĞER (S2) | **SUS** — KULLANICIYA SORULMALI SK-31 |
| S145: şüpheli tarihinden önceye tahsilat, o tarihte aşım | DEĞER = B (kabul) | **DEĞER = A (RET)** (Y15-6) |
| S145: eşitlik / aynı gün / öncesi ama borç yetiyor / sonrası | DEĞER (kabul) | DEĞER (kabul — değişmedi) |
| S145: tahsilat dışı adım aşım doğuruyor | DEĞER (kabul) | **SUS** — KULLANICIYA SORULMALI SK-33 |
| S145: aşım önceden var / aynı günün borcu kararı değiştiriyor | DEĞER (kabul) | **SUS** — KULLANICIYA SORULMALI SK-34 |
| S151: satış kartında iade payı | DEĞER = A (sayar) | **DEĞER = B (saymaz)** (Y15-7) |
| S151: satış kartı olmayan kartta iade / iade artanı / Değersiz payı | DEĞER (sayar) | **SUS** (ödenen) — KULLANICIYA SORULMALI SK-32 |
| S142 / S150 / S147 | alan yok | alan yok |
| S148 | DEĞER = A | DEĞER = A (onay; elle senaryo) |
| S137 / S138 | SUS (KULLANICIYA SORULMALI) | SUS — BİLİNEN SINIR (metin) |
| S141 (kart fazlası — fatura belge açığı) | DEĞER = A | **SUS** — BİLİNEN SINIR |
| S143 (a) (karşı yönlü kalemli kartlı caride kart Kalan) | DEĞER = C | **SUS** — BİLİNEN SINIR |
| S144 (c) (kartın kendi fazla tahsilatı — Tahsil Edilen) | DEĞER = A | **SUS** — BİLİNEN SINIR |
| S149 (söz geçmiş, vade gelmemiş — takvim kalemi + gecikmiş) | DEĞER = C | **SUS** — BİLİNEN SINIR |

### KULLANICIYA SORULMALI (bakım 15; kâhin bu durumlarda SUSAR — ders 43, SORU DÜZENİ)
- **SK-30 (S136 × şüpheli tarihinden SONRA Taksit Tahsilatı — S138 ailesi; UÇ DURUM DEĞİL — taksitli şüpheli müşteri ödemeye devam ederse):** 01.04 Borç X 400 · 15.04 Taksitler'den kart 400 (2 × 200:
  01.05, 01.06; kart X'i içine alır) · 10.05 fatura F 600 · 20.05 Şüpheli Alacağa Al 300 · 25.05 karta Taksit Tahsilatı 200 · bugün 15.06. Bakiye 800; kart 'Tahsil Edilen 200 · Kalan 200' iki okumada
  aynı. **A (Y14-4 aynen — tahsilat şüpheliden düşer, kalan şüpheli 100 kuyruktan en eskiden):** 1. taksit yok, F 500, 2. taksit 200 (gecikmiş 700) / **B (S138'in B'si gibi — tahsilat yalnız kendi
  taksitini kapatır, şüpheliye alınan 300'ün düşüşü değişmez):** 1. taksit yok, F 300, 2. taksit 200 (gecikmiş 500) / **C (öneri — S138 = C ile aynı aile):** uç durum böyle kalsın (BİLİNEN SINIR).
- **SK-31 (S140'ın sınırları; UÇ DURUM):** satışla açılan kart, sonra faturasız stok iadesi. (a) iade kartın açığından BÜYÜK: elle Borç 500 (vade 20.06) + satış kartı 1.000 (2 × 500: 01.06, 01.07) →
  10.06 iade 1.200; bakiye 300. **A (öneri — KS7 (a) "iade artanı bağsız ödeme"):** kart kapanır, artan 200 carinin öbür borcunu kuyruk sırasıyla kapatır → elle Borç Kalan 300 / **B:** artan carinin
  alacağı (avans) kalır, elle Borç 500 açık. (b) carinin başka satışı da var (satış faturası F 600 + satış kartı 1.000 → iade 400): **A (öneri — S140'ın harfi, kartın kendi satışı önce):** kartın 1.
  taksiti 400 kapanır, F 600 açık / **B (KS7 (a) / S2 — kuyruk sırası):** en eski kalem kapanır. (c) iadenin geri ödemesi (iade 300 sonra müşteriye 300 iade bedeli ödenir): **A (öneri — KS8.1 "geri
  ödenen iade kapatıcı değil"):** kartın 1. taksiti yeniden 500 açık / **B:** kart küçülmüş kalır, geri ödeme ayrı. **C (her biri için):** uç durum böyle kalsın (BİLİNEN SINIR). Bakiye her seçenekte aynı.
- **SK-32 (S151'in dışı — satış kartı olmayan kartta iade / Değersiz; UÇ DURUM):** 01.03 Borç 900 · 15.03 Taksitler'den kart 900 (3 × 300) · 10.04 faturasız stok iadesi 300 (ya da Değersiz Alacak Yaz 300 /
  iade faturasının artanı 300); bakiye 600. **A (öneri — S151'in ilkesi "iade tahsilat değildir" bütün kartlarda):** 'Tahsil Edilen 0 · Kalan 600', 1. taksit 'Ödenen 0' / **B (S129 tek kuyruk aynen):**
  'Tahsil Edilen 300 · Kalan 600', 1. taksit 'Ödenen 300' / **C:** uç durum böyle kalsın (BİLİNEN SINIR). Kalan ve bakiye iki okumada aynı.
- **SK-33 (S145'in dışı — tahsilat DIŞINDAKİ geriye tarihli kayıt şüpheli tarihinde borcu aşırıyor; UÇ DURUM; BAKİYE OKUMALAR ARASINDA FARKLI):** borç 1.000 (01.05) → 01.06 Şüpheli 900 → sonra 20.05
  tarihli alınan çek 300 (ya da elle Alacak 300 / faturasız stok iadesi 300 / 300'lük borç kaydının silinmesi). **A (öneri — S145'in genellemesi: o
  tarihte borcu şüpheli tutarın altına düşüren her kayıt reddedilir):** ret, bakiye 1.000, şüpheli kalan 900 / **B:** kabul — bakiye 700, şüpheli kalan 900 (o tarihte borcu aşar; görünen kalemler 0) /
  **C:** uç durum böyle kalsın (BİLİNEN SINIR — kâhin susar).
- **SK-34 (S145'in sınırı — UÇ DURUM; BAKİYE OKUMALAR ARASINDA FARKLI):** (a) aşım tahsilattan ÖNCE zaten var (şüpheli kaydı girildiğinde sonradan tarihli borç da sayıldı): 01.06 Borç 400 · 20.06 Borç
  600 · 25.06'da 10.06 tarihli Şüpheli 900 (o gün borç 400) · sonra 05.06 tarihli tahsilat 50. **A (öneri — "o tarihte aşar" — ret):** bakiye 1.000 / **B (aşım tahsilattan doğmadı — kabul):** bakiye
  950. (b) şüpheliyle AYNI gün borç: 01.06 Borç 1.000 · 10.06 Borç 200 · 10.06 Şüpheli 1.100 · 05.06 tarihli tahsilat 50: **A (öneri — o günün borcu şüpheliden önce sayılır, borç 1.150 ≥ 1.100 —
  kabul):** bakiye 1.150 / **B (o günün borcu sayılmaz, 950 < 1.100 — ret):** bakiye 1.200. **C (ikisi için):** uç durum böyle kalsın (BİLİNEN SINIR).

### Kurallar (kod commit'i; yorumların `model.py`'deki karşılığı)
- **C26.1 `s130` (Y15-1 / Y15-2 / Y15-3 / Y15-10 / Y15-11):** SK-27 susması KALKTI — R kart taksitlerine, taksitli faturanın taksitlerine ve verilen avans kalemine (`_avans_kalemleri250`: tek taraflı kuyruğun
  borç tarafı artanı; "avans:<ödeme>" / "avans:ciro:<evrak>", vade = belge = ödeme günü, yazım sırası ödemenin) de kuyruk sırasıyla (`_anahtar250`) düşer. Sıra: şüpheliden düşen FATURAYA bağlı ödeme /
  iade faturası / elle Alacak → SUS "… BİLİNEN SINIR (kullanıcı kararı S138 = C) S138"; şüpheliden düşen Taksit Tahsilatı → SUS "… KULLANICIYA SORULMALI SK-30"; avanslı caride iade kalemi → SUS
  (kâhinin sınırı); avanslı caride ilk şüpheli kaydından (gün, yazım) sonra doğan kalem / avans → SUS "… S137 = C"; avanssız caride O2 artık `_alacak_hesap250` ile (S101 R1 / R2 ana hesapla aynı —
  `_alacak_tarafi_250`'den ayrıldı; sonuç aynen) ve O1 ≠ O2 ya da O2'de tanımsızlık nedeni → SUS "… BİLİNEN SINIR (kullanıcı kararı S137 = C) S137 (§26 Y15-10; SK-28 (a))".
- **C26.2 görünüm (Y15-1 / Y15-2):** `kontrol_v3` Ödeme avans kalemi (`takvim | vadeTakip | projeksiyon:hareket:<ödeme>`) S130 "alan"da görünen tutarla (etiket KULLANICI); S110 alanında kartın içine aldığı
  satış faturası kalemi görünen tutarla; `_cari_kalemleri` şüpheli kayıtlı caride avansı görünen tutarla sayar, düşen tutar (Σ kuyruk − Σ görünen) avansı da kapsar (Σ = bakiye − R).
- **C26.3 `_gecikmis_s139` (Y15-4):** şüpheli kayıtlı caride `cari:<ad>:gecikmis` = Σ görünen kalem {v < bugün} + Σ görünen avans {gün < bugün}; tanım koşulları C16.4'ün yalın olmayan kolu aynen (çapraz
  yok, `_s98_dis` yok, Σ kuyruk = bakiye, açık iade notu yok); S130 SUS'ta yazılmaz (belirsiz kaydı S130'un). Mutantlar 209 / 210 / 211 / 231 aynen geçerli.
- **C26.4 S140 `_alacak_govde250` / `_tyk` (Y15-5):** satışla açılan kartın (gün, yazım) anahtarından SONRAKİ faturasız stok iadesi kaynağına `hedef_kart`: kaynağın kendi gününde önce o kartın açık
  taksitleri (vade → yazım) kapanır; artan > 0 → neden "S140 … SK-31 (a)" (C13.4 (11) düzeni); carinin birden çok satış kartı / satış faturası / kartın kendi satışı dışında stok veresiye satışı → neden
  "SK-31 (b)"; iadenin geri ödemesi (G > 0) → neden "SK-31 (c)".
- **C26.5 S151 `kontrol` kart göstergeleri (Y15-7, Y15-13, Y15-14):** `_tyk(…, para_disi, ek)` kalem başına para DIŞI kapatıcı payını tutar (`son["pd"]`: "stok" faturasız stok iadesi, "iade" iade faturasının
  artanı, "deg" Değersiz). Satış kartında (yalnız "stok" payı) `odenen` / `taksit<i>:odenen` = TYK payı − stok iadesi payı (etiket KULLANICI); `kalan` = tutar − TYK payı (aynen). Satış kartı olmayan kartta
  (ya da satış kartında "iade" / "deg" payı) herhangi bir para dışı pay → `odenen` ve `taksit<i>:odenen` yazılmaz (SK-32). Kartın kendi tahsilatının fazlası (`son["kartfazla"]`) → `odenen` yazılmaz
  (S144 = C). Karşı yönlü yükümlülük kalemli (`_capraz250`) kartlı cari → `kalan` yazılmaz (S143 = C). Yazılmayanlar `belirsiz`'e "kart <no> göstergeleri kısmen tanımsız (2.5.0 §26): …".
  ≤ 2.4.9: `odenen` taşınan tahsilatların toplamı AYNEN (değişmedi).
- **C26.6 S141 (Y15-12):** `son["kartfazla"]` boş değilse carinin satış faturalarının `fatura:<ad>:acik`'ı ve `kontrol_acik_toplam` (açık toplamı) yazılmaz; takvim kalemleri yazılır.
- **C26.7 S149 (Y15-16):** `kontrol_v3`: açık elle kaydın Vade Tarihi ≥ bugün ve Beklenen Ödeme Tarihi < bugün → `takvim:hareket:<ad>` yazılmaz (Vade Takip / projeksiyon kalemi yazılır); `kontrol`:
  carinin böyle bir borç yönlü açık kaydı varsa (`_s149_kalemler`) `cari:<ad>:gecikmis` yazılmaz. İkisi `belirsiz`'e "… BİLİNEN SINIR (kullanıcı kararı S149 = C) S149".
- **C26.8 S145 `kos` / `_s145_adim` / `_s145_asim` / `_tarihli_kalemler` (Y15-6):** şüpheli kaydı olan kâhinde her durum değiştiren adım (S145_DISI dışında) denetlenir. `_tarihli_kalemler`: bakiyeye
  giren bütün satırlar tarihleriyle (Σ = bakiye değilse ya da iade faturasının geri ödemesi varsa None); karşılıksız dönen carili evrak her tarihte 0 (B2.2 / C13.4 (8) ve ŞÜPHELİ KALAN ile aynı —
  geliştirme sırasında rastgele s1'de "tarihli borç kurulamıyor" diye yanlış susan 9 adımla görüldü ve düzeltildi). `_s145_asim`: ŞÜPHELİ KALAN'ın zaman çizelgesiyle (`_supheli_olaylar` —
  `_supheli_hesap`'ten ayrıldı; sonuç aynen) her kaydın alınış anında (gün → sınıf → yazım) K1 iki biçimde (o günün borç yönlü satırları dahil / hariç). Tahsilat (`tahsilat`, `kart_tahsilat`) tarihi bir
  kaydın gününden önceyse: yeni aşım yoksa kabul; aşım önceden varsa SUS SK-34 (a); iki biçim ayrışıyorsa SUS SK-34 (b); öbür durumda durum geri alınır (`S145_SNAP_DISI` dışındaki alanların
  kopyası) ve adım `("ret", "KULLANICI", "§26 Y15-6 S145 A …")`. Öbür adımlar: herhangi bir kayıtta YENİ aşım → SUS SK-33. SUS adımları `sus_s145` → `kos` sonunda iki dünya (adım kabul ↔ adım
  yok) karşılaştırılır, farklı çıkan denetimler silinir, `belirsiz`'e "adım <id>: cari <ad> S145 — … KULLANICIYA SORULMALI SK-33 | SK-34 (a) | SK-34 (b) (§26 Y15-6)".
- **C26.9 iz:** `self._iz15` (cari → {"s136", "s139", "s140", "s140sus", "s145ret", "s145sus", "s149", "s141", "s143", "s144", "s151", "sk32", "sk30", "s137", "s138"}) — sonucu değiştirmez; G3 sınıflaması için.
- Mutantlar 286–298 (`MUTASYONLAR`): 286 S136 B (taksit / avans düşmez) · 287 S136 yarım (avans düşmez) · 288 S139 B (gecikmiş kuyruktan, şüpheli dahil) · 289 S139 yarım (taksitler kuyrukla) · 290 S140
  öncesi (iade S2 sırasıyla) · 291 S140 B (kart elle borcu içine alır: önce kart dışı kalemler, sonra kartın son taksiti) · 292 S140 yarım (kartın taksitlerine sondan) · 293 S145 B (kabul) · 294 S145 sınırı
  (eşitlikte ret) · 295 S145 sınırı (aynı gün de "önceki") · 296 S145 yarım (önceki her tahsilat ret) · 297 S151 A (iade sayılır) · 298 S151 yarım (taksit 'Ödenen' sayar).
- `--kural 2.4.9` / 2.4.6 / 2.4.5 / `--legacy`: hiçbir yol değişmedi (bütün yeni dallar `k250`; `_supheli_hesap` / `_alacak_tarafi_250` ayrımları sonuç aynen; ≤ 2.4.9 kart `odenen`'i aynen —
  geliştirme sırasında d43'te bir kez `pay` toplamı yazılmıştı, eşdeğerlik denetimi yakaladı, düzeltildi).

### C8s Nasıl bozulur? (bakım 15 — kod commit'inde, senaryolarla birlikte yazıldı)
| # | Bozulma | Senaryo |
|---|---|---|
| Z173 | Şüpheli tutar taksitlerden / avanstan düşmez (S136 B) ya da avanstan düşmez | d40 Q3 / Q4, d41 R2 / R3 / R4 / R5 (mutant 286, 287) |
| Z174 | Kart göstergeleri şüpheliyle değişir ("göstergeler değişmez"in tersi) | d40 Q3, d41 R2 / R3 (kart 400 / 0) |
| Z175 | Kuyruk sırası S130'dan farklı (belge tarihi / en yeniden) taksitli / avanslı caride | d41 R4 / R5, d39 N1 (mutant 281, 285 — ayrıntı `kahineski15-mutant-senaryo-*`) |
| Z176 | Şüpheli kayıtlı caride gecikmiş kuyruktan (şüpheli dahil) ya da taksitler kuyrukla | d39 N1 … N13a, d40 Q3 / Q4, d41 R2 … V1 (mutant 288, 289) |
| Z177 | Şüpheliden sonra Taksit Tahsilatı / sonra doğan kalemde değer uydurulur | d41 R7 (SK-30), d40 Q1 / Q1b (S137) |
| Z178 | Satış kartından sonraki iade S2 sırasıyla / kart elle borcu içine alır / sondan | d42 T1 / T2 / T3 / T6 (mutant 290, 291, 292) |
| Z179 | İade satış kartının açığını aşınca / başka satış varken / geri ödemeyle değer uydurulur | d42 T4 / T5 / T8 (SK-31) |
| Z180 | 'Tahsil Edilen' / taksit 'Ödenen' iadeyi sayar (S151 A) ya da yalnız biri | d42 T1 / T2 / T3 / T6 (mutant 297, 298) |
| Z181 | Satış kartı olmayan kartta iadeyle 'Tahsil Edilen' uydurulur | d42 T7 (SK-32) |
| Z182 | Şüpheli tarihinden önceye tahsilat kabul (S145 B); eşitlikte / aynı günde / borç yetiyorken ret | d39 N11, d41 S1 / S6 (mutant 293), S5 (294), S3 (295), S4 (296) |
| Z183 | Tahsilat dışı adım / sınır durumda kabul ya da ret uydurulur | d41 S7 (SK-33), S8 (SK-34 (a)), S9 (SK-34 (b)) |
| Z184 | BİLİNEN SINIR alanında değer yazılır (S141 / S143 / S144 / S149) ya da komşuda susulur | d43 U1 … U7, d12 F2, d30 Q1 / Q3, d34 E10 |
| Z185 | Vadesi geçmiş, sözü ileride borç projeksiyonda iki kez ya da gecikmişlere | d41 W1 (S148) |

### Senaryolar (bakım 15; elle tablolar — kâhin koşulmadan karar metinlerinden ve §26'dan; betikler `docs/kanit/2026-11-13/kahineski15-arac/yeni-senaryolar15.py`, `d39-d40-guncelle15.py`, `d12-d30-d34-guncelle15.py`)
- **`d41-c5-s136-s139-s145-s148`** (bugün 15.06.2026; 129 elle denetim): R2 / R3 S136 kararın örneğinin komşuları (şüpheli 200 1. taksiti tam bitirir → gecikmiş 800; 500 aşıp faturaya geçer → gecikmiş 500;
  kart göstergeleri 400 / 0 değişmez) · R4 taksitli fatura (S99) + elle Borç (vade 20.06): R 300 → F#1 0, F#2 100, Borç 300 (takvim kalemi 300, kendi vadesinde), gecikmiş 100 · R5 verilen avans: Borç 200 +
  Ödeme 300 → şüpheli 400 → Borç 0, avans kalemi 100, gecikmiş 100, görünüm toplamı 100 · R7 SK-30 (şüpheliden sonra Taksit Tahsilatı — SUS; kart 200 / 200) · V1 S139: şüpheli gecikmiş Borç'u bitirir
  (gecikmiş 0; B 300) · S1 S145 kararın örneği (borç 1.000 · 16.05 şüpheli 900 · 06.05 tarihli tahsilat 300 → RET; bakiye 1.000, görünen 100, gecikmiş 100) · S2 kararın "bugün" örneği (kabul;
  bakiye 700, şüpheli kalan 600 → görünen 100) · S3 aynı gün (kabul) · S4 öncesi ama borç yetiyor (kabul; görünen 200) · S5 tam eşitlik (kabul; görünen 0) · S6 şüpheliden önceye Taksit Tahsilatı (RET;
  kart 0 / 400) · S7 SK-33 (önceye tarihli çek — SUS) · S8 SK-34 (a) · S9 SK-34 (b) · W1 S148 (vade 05.06, söz 30.06 → projeksiyon kalemi söz gününde, takvim ufuk dışı, gecikmiş 100).
- **`d42-c5-s140-s151-satis-karti-iade`** (74 elle denetim): T1 S140 kararın örneği AYNEN (Borç 500 vade 20.06 + satış 1.000 (01.06 / 01.07) → iade 800 ⇒ kart Kalan 200, Tahsil Edilen 0, taksit Ödenen 0 / 0,
  gecikmiş 0, Borç Kalan 500 ve takvim kalemi 500, bakiye 700) · T2 S151 kararın örneği AYNEN (iade 300 ⇒ Tahsil Edilen 0, Kalan 700, bakiye 1.200, gecikmiş 200) · T3 iade satışın tamamı (kart 0) · T4 / T5 /
  T8 SK-31 (a) / (b) / (c) (cari tanımsız; bakiye ve kart tutarı yazılır) · T6 kart tahsilatı 300 + iade 400 ⇒ Tahsil Edilen 300, Kalan 300, taksit Ödenen 300 / 0 · T7 SK-32 (Mevcut Borç kartı + iade;
  Kalan 600 yazılır, Ödenen'ler yazılmaz).
- **`d43-c5-bilinen-sinir-sus15`** (42 elle denetim): U1 S144 (c) (kart 1.000, kart tahsilatı 1.100 — Tahsil Edilen yazılmaz; Kalan 0, taksitler 500 / 500) · U2 S141 + S144 (F 600 + Borç 400 → kart 400 → kart
  tahsilatı 600: fatura belge açığı ve açık toplamı yazılmaz, takvimde F 400) · U3 S143 (a) (Alacak Yaz 200 — kartın Kalan'ı yazılmaz) · U4 / U6 S149 (söz geçti, vade 25.06 / bugün — takvim kalemi ve
  gecikmiş yazılmaz; Vade Takip / projeksiyon kalemi söz gününde) · U5 söz günü (K6.3 'today' 0) · U7 vade ve söz geçmiş (C15.1 'Gecikmiş', vadeden −10; gecikmiş 150).
- **`d39` (karar gereği güncellendi):** S139 — 13 şüpheli carinin gecikmişi `elleYok`'tan değere (N1 = S139'un kendi örneği 800; N1b 800, N2 300, N3 200, N4 0, N5 200, N6 200, N7 200, N8 200, N10 500, N11 0,
  N12 400, N13a 300); S145 — N11 (04.06 tarihli tahsilat, 05.06 şüpheli 500, borç 500) RET: bakiye 200 → 500, Kalan 200 → 500, `adim:n11t:durum` "ret". **`d40`:** S136 — Q3 (kararın örneği) gecikmiş 700;
  Q4 (verilen avans) Borç kalemi 200 + avans kalemi 200, gecikmiş 400, görünüm toplamı 400; SK-27 `elleBelirsiz`'i kalktı; Q1 / Q1b / Q2 nedeni S137 = C / S138 = C.
- **Eski elle tablolarda BİLİNEN SINIR'a çevrilen beklentiler (`d12-d30-d34-guncelle15.py`):** d12 F2 (vade bugün, söz geçmiş — S149: takvim kalemi + gecikmiş `elleYok`), d30 KQ1 / KQ3 (kartın kendi tahsilatının
  fazlası — S144: `odenen` `elleYok`), d34 KE10 (alış faturalı kartlı cari — S143: `kalan` `elleYok`). **Açıkça:** bu beş beklentinin SUS'a çevrileceği önceden yazılmamıştı; yeni kâhinin öz testi bu beş
  denetimi "ANAHTAR YOK" diye kırmızı verdi, her birinin adımları okunup S149 / S144 (c) / S143 (a) alanında olduğu (Y15-12 … Y15-16'nın tanımıyla) doğrulandıktan sonra `elleYok`'a alındı — değer
  uydurulmadı, yalnız susma (değer kâhine göre DEĞİL, karar alanına göre).
- **İlk koşu:** d39 … d43'ün 575 elle denetiminin hepsi yeni kâhinle ilk koşuda aynı (elle değerler yazılmadan önce kâhin bu alanlarda koşulmadı). Senaryolarda seriden numara alan belgeler tarih sırasıyla
  (G1); S145 senaryolarında önceye tarihli tahsilat adımı ŞÜPHELİ kaydından SONRA yazılır (carinin kendi adım sırası — G1 aracı korur).

### C10s Mutantlar (bakım 15; `oz-test.py` DEĞERLE — çökmeden, elle tablo kırmızı)
286 (d41 — R4 / R5) · 287 (d41 R5 avans kalemi) · 288 (d39 N1 gecikmiş) · 289 (d40 Q3 gecikmiş) · 290 / 291 / 292 (d42 T1) · 293 / 294 (d39 N11; 294 ayrıca d41 S5) · 295 (d41 S3) · 296 (d41 S4) · 297 / 298 (d42
T1). Bakım 6 … 14 mutantları (241–285) aynen yakalanıyor (`oz-test.py`; `mutant-senaryo.py` 261–298 × d35 … d43).

### Dil ekleri (/3, bakım 15)
Yeni adım YOK; yeni çıktı anahtarı YOK. `tahsilat` / `kart_tahsilat` 2.5.0'da S145 ile "ret" dönebilir (`adim:<id>:durum`). Şüpheli kayıtlı caride `cari:<ad>:gecikmis` ve verilen avans kalemi artık yazılır
(S139 / S136). `belirsiz` kayıtları: "… S138 = C) S138", "… KULLANICIYA SORULMALI SK-30", "… S137 = C) S137", "S140: … SK-31 (a) | (b) | (c)", "kart <no> göstergeleri kısmen tanımsız (2.5.0 §26): … SK-32 |
S144 = C | S143 = C", "… satış faturalarının belge açığı tanımsız (2.5.0 §26 Y15-12) … S141", "takvim kalemi <ad> … S149", "cari <ad> gecikmiş tutarı tanımsız (2.5.0 §26 Y15-16) … S149", "adım <id>: cari <ad>
S145 — … SK-33 | SK-34 (a) | SK-34 (b)".

### Eşleme notları (ana oturum için; `kos.mjs` bu bakımda DEĞİŞMEDİ, açılmadı)
- Yeni adım yok; d41 / d42 / d43 mevcut adım türleriyle (`cari_ac`, `borc {vade, beklenen}`, `alacak`, `tahsilat`, `odeme`, `fatura {taksit}`, `evrak`, `kart_ac {mevcut}`, `kart_tahsilat`, `stok_satis_taksit`,
  `stok_iade`, `supheli_al`). S145'in reddi `tahsilat` / `kart_tahsilat` adımının durumudur — programın ret yanıtı (HTTP kodu / ileti) karar metninde yok; koşucu adımı "ret" okuyabilmeli (iletisi
  denetlenmez).
- **Ana oturuma:** `model.py` değişti — mobil yazma kâhininin `cari_model_sha256`'sı yeniden üretilmeli (o dosya okunmadı); yapım aşaması listesi bu ajanca açılmadı (S136 / S139 / S140 / S145 / S151
  alanındaki yeni değerler ve S141 / S143 / S144 / S149 alanında kalkan beklentiler listede DEĞİŞEN / YENİ / KAPANAN kayıt olarak görünebilir — ayrıştırma ana oturumda).

### C12s DENENMEYEN (bakım 15; neden)
- Program koşulmadı (görev). Programın S136 … S151 alanındaki gösterimi bilinmiyor (yalnız soru metinlerindeki örnekler).
- S136: taksit kaleminin takvim / Vade Takip tutarı kâhinin dilinde yok; S110 / S126 alanı dışındaki kartlı caride fatura kaleminin takvim tutarı yazılmıyor (K6.5 sınırı — değişmedi) → kararın örneğindeki
  "1. taksit yok, F 500, 2. taksit 200" kalem kalem değil gecikmişte (700) ve kartsız taksitli faturalı caride (R4) denetlendi. Kart şüpheliden SONRA açıldığında kartın kabulü şüpheli kayıtlı caride zaten
  SK-18 ile susuyor (Y7-3 bakiye okuması "okunamıyor") — S137'nin kart kolu için senaryo yazılmadı. Ciro avansıyla S136 (kalem kimliği yok — SK-7) senaryosu yok.
- S145: tahsilat dışı adımlardan (SK-33) yalnız alınan çek elle senaryoda; elle Alacak / stok iadesi / borç silme / geri yükleme yalnız rastgele s1'de (hareket_sil, hareket_geri_yukle) görüldü. Havale
  tahsilatı, birden çok şüpheli kaydı, Değersiz yazılmış kayıtla önceye tahsilat elle senaryoda yok. Ret iletisi / kodu (karar metni vermedi).
- S140: satış kartında Değersiz / iade faturası artanı payı (SK-32 dalı); kart tahsilatının iadeden SONRA tarihli olduğu düzen; iade + iade geri ödemesinin ayrıntısı (yalnız SUS denendi).
- S151: "iade ayrı gösterilir"in gösterim anahtarı yok. S142 / S147 / S150 alan yok; S144 (d) / (e) DENENMEYEN; S149'un alacak yönlü (Ödenecek Borç) kalemi senaryosu yok.
- İki şirket / yedek geri yükleme / silinen şüpheli kaydı ile bu bakımın kuralları.

### C0s Değişen eski beklentiler (G3; bakım 14 (`bafd9aaf` ağacı — çalışma dalı ucu) ↔ bakım 15 kâhin çıktısı, `2.5.0`; eski kopyanın 94 elle senaryosu + d41 / d42 / d43 + rastgele s1 / ux18 tohum 1–10 × 120) — kararla ilgisiz eski beklenti DEĞİŞMEDİ
Eski 49.526 → yeni 49.200 denetim; değişen / kalkan / yeni toplam **468**; **BEKLENMEYEN 0** (dökümü `docs/kanit/2026-11-13/kahineski15-g3-dokum-*.json` — iki saat diliminde bayt bayt aynı; özet
`kahineski15-esdeger-cari-*.log`). Sınıf, yeni modelin `_iz15` / `s130` izinden cari cari; anahtar türü sınıfın alanında olmak zorunda:
- **S145 (268: 244 kalkan + 18 değişen + 6 yeni):** d39 N11 (bakiye 200 → 500, Kalan 200 → 500, `adim:n11t:durum` "ret" yeni), d41 (S1 / S6 ret, S7 / S8 / S9 iki dünya), rastgele s1 tohum 3 / 8 / 9 / 10 (75 + 61 + 74 + 7
  kalkan — SK-33 iki dünyası: `hareket_sil` (borç kaydının silinmesi şüpheli gününde borcu şüpheli tutarın altına düşürüyor) ve `hareket_geri_yukle`; rastgele üretici tarihleri artan ürettiği için
  önceye tarihli tahsilat — dolayısıyla RET — rastgelede yok). Geliştirme sırasında karşılıksız evrak da 9 adımda yanlış susuyordu (tarihli borç yardımcısının hatası — C26.8) — düzeltildi.
- **S136-alan (21 yeni):** d40 Q4 (Borç / avans kalemleri, görünüm toplamı — 9), d41 (12). **S139 (23 yeni):** d39 12 şüpheli carinin gecikmişi, d40 Q3 / Q4, d41 9.
- **S140 (22 değişen + 35 kalkan) / S151 (4 kalkan):** yalnız d42 (eski kâhin iadeyi S2 sırasıyla dağıtıp elle borcu kapatıyordu; SK-31 carilerinde C13.4 (11) düzeni).
- **S141 (3) / S143 (3) / S144 (4) / S149 (37) kalkan — BİLİNEN SINIR'lar DEĞER'den SUS'a:** d43; d19 (S143 — karşı yönlü kalemli kartlı cari, elle tabloda yoktu), d34 E10, d30 Q1 / Q3, d12 F2, c6b (S149 3), rastgele
  s1 tohum 3 / 4 / 7 / 8 / 9 (S149 28 — rastgele üretici sözü vadeden önce de üretiyor).
- **GENEL (2 değişen + 46 kalkan):** aynı kontrolde sınıflı değişiklik olan senaryoda Kasa / sayaç / mizan (S145'in iki dünyası Kasa'yı da ayırır; N11 reddi Kasa'yı 300 düşürür).
- **Öbür 84 eski elle senaryo ve 14 rastgele: fark 0** (adımları değişen eski senaryo 0).
- **Eski ELLE tablolarda değişen beklentiler** (`kahineski15-elle-fark-*.log`, 94/94 izinli): d39 29 (13 gecikmiş `elleYok`'tan değere + N11 3), d40 29 (Q3 / Q4 değerleri, SK-27 kayıtları kalktı, Q1 / Q1b / Q2
  metni), d12 6 / d30 6 / d34 3 (BİLİNEN SINIR — değerden `elleYok`'a + `elleBelirsiz`). Öbür 89 dosya ve bütün dosyaların adımları AYNI.
- `--kural 2.4.9` / 2.4.6 / 2.4.5 / `--legacy`: **468/468 bayt bayt aynı** (94 eski elle + d41 / d42 / d43 + 20 rastgele × 4 kip); üretici 20/20 aynı dizi.
- **Yeni / değişen elle tablolar ESKİ (bakım 14) kâhinde — beklenen NEDENLE kırmızı (ders 7, 38):** 990 elle denetimin **143**'ü (`kahineski15-kirmizi-eski-cari-*.log`; d41 48, d42 39, d43 16, d39 16, d40 14, d12
  4, d30 4, d34 2): 47'si "ANAHTAR YOK" (şüpheli caride gecikmiş / görünüm, S145 ret durumu eski kâhinde yazılmıyordu), 37'si eski kâhinin SUS alanında değer yazması (S141 / S143 / S144 / S149, SK-31 /
  SK-32 / SK-33 / SK-34), 23'ü `belirsiz` kaydı yok, 36'sı değer farklı (S136 — eski kâhin SK-27'de; S140 iadesi S2 sırasıyla; S145 kabul; S151 iade 'ödenen' sayılıyordu); 847'si iki kâhinde aynı.

### Kanıt (bakım 15; iki saat dilimi — UTC ve Europe/Istanbul çıktıları bayt bayt aynı (başlık satırları dışında); kâhin `ead8f4b3`, temiz ağaç; `docs/kanit/2026-11-13/kahineski15-*`, araçlar ve koşu betiği `kahineski15-arac/`)
cari öz test **6.295/6.295** (`-cari-oz-*`: elle tablolar 97 senaryo, mutantlar 200–298 — 219–298 değerle) · mutasyon taraması **265/265** (`-cari-mutasyon-*`) · eşdeğerlik + G3 **583/583** (`-esdeger-cari-*`) ·
yeni / değişen elle tablo **990/990** (`-elle-yeni-cari-*`: d41 129 + d42 74 + d43 42 + d39 235 + d40 95 + d12 40 + d30 138 + d34 237) · ESKİ kâhinde **143 kırmızı** / 990 (`-kirmizi-eski-cari-*`) · eski elle
tablo farkı **94/94** izinli (`-elle-fark-*`) · G1 tarama **97/97** (`-g1-tara-*`) · mutant ↔ senaryo **342/342** (`-mutant-senaryo-*`; d35 … d43 × 261–298) · geniş tarama **2.201/2.201** (`-genis-tarama-*`; bakım 14
ile aynı sayı) · defter öz testi **181/181** (`-defter-oz-*`; bu bakım defter kâhinine dokunmadı). Öz test, mutasyon, eşdeğerlik ve geniş tarama `flock -s -n …/olcum.lock` ile (ders 52); her adım
`timeout` sınırlı. Program açılmadı. Koşu günlükleri `kahineski15-kos-utc.txt` / `-ist.txt` (yük 1,3 / 3,0 — 4 çekirdek).

## 27. 2.5.0 Ç5 bakımı 16 — S155 (Şüpheli Alacak kuralının ölçüsü TOPLAM borç) + S158 ('iade tahsilat değildir' her kartta) + S156 / S157 = C (BİLİNEN SINIR) + S154 (bilgi) (13.11.2026, `date -u` 08:46; kararlar 13.11.2026 08:35 UTC ve 07:31 UTC — ana oturumun özet dosyası; eski kâhinler bakımı 16 — kodu görmeyen AYRI el; KÜÇÜK düzeltme bakımı) — kural seti `2.5.0` = §13 + … + §26 + bu bölüm

Bu bakım bakım 15'in TOPLU sorularının (SK-30 … SK-34) yanıtlarını işler: S155 = A (SK-33 + SK-34 — S145'in ölçüsü), S158 = A (SK-32), S156 = C (SK-30), S157 = C (SK-31 (a) / (b) / (c)); ayrıca S154 = B
(bilgi — S144 (c) ile sınırı). §13–§26'nın öbür kuralları DEĞİŞMEZ. `--kural 2.4.9` (ve 2.4.6 / 2.4.5 / `--legacy`) AYNEN. Defter kâhini (`test/bagimsiz/defter/`) DEĞİŞMEZ (S155'in reddi yevmiye
yazmaz; S158 bakiyeyi ve yevmiyeyi değiştirmez). **Bu bölümün ilk commit'i yalnız YORUMDUR (ders 40 — önce kural, sonra kod); senaryo / mutant / G3 sayıları kod ve kanıt commit'lerinde eklenir.**

### C00t Temiz oda (bakım 16)
- **Girdi (tek kaynak; ana oturumun özet dosyası `scratchpad/kahin-eski16-kararlar.md`; KURAL KAYNAĞI yalnız KARAR satırlarıdır — soru metnindeki "program bugün (koşuldu)" sözü beklenti kaynağı
  sayılmadı):**
  - S155 KARAR (13.11 08:35, AYNEN): "S155 = A — Şüpheli Alacak kuralının ölçüsü TOPLAM borçtur: bir kayıt (tahsilat, çek, Alacak Yaz, iade, borç silme, geri yükleme — türü fark etmez) ancak
    'kayıttan sonra carinin borcu açık şüpheli tutarın altına düşüyorsa' reddedilir; şüpheliye alma günündeki borca ayrıca BAKILMAZ (örnek: borç 1.000 → şüpheli 900 → sonradan yeni borç 500 →
    şüpheli tarihinden önceye tahsilat 300 KABUL, bakiye 1.200; yeni borç yokken aynı tahsilat RET, bakiye 1.000). S145 = A bu ölçüyle okunur."
  - S158 KARAR (13.11 08:35, AYNEN): "S158 = A — 'iade tahsilat değildir' (S151 = B) HER kartta geçerlidir: satış kartı olmayan kartta da faturasız stok iadesi ve Değersiz yazma kartın 'Tahsil
    Edilen'ine / taksit satırının 'Ödenen'ine SAYILMAZ (örnek: Borç 900 → kart 900 → iade 300: 'Tahsil Edilen 0', 'Kalan 600')." Soru metninin A satırı: "evet — her kartta 'Tahsil Edilen 0' (iade ve
    Değersiz yazma tahsilat sayılmaz; tek kural …)".
  - S156 = C, S157 = C (13.11 08:35) — BİLİNEN SINIR (soru metinleri girdi dosyasında AYNEN; bakım 15'in SK-30 / SK-31 sorularıdır).
  - S154 = B (13.11 07:31, AYNEN): "'Fazlasını Avans Yaz' ile kapanan kartta 'Tahsil Edilen' karttan alınan paranın TAMAMIDIR (kart 1.200 / 3; karttan 500, sonra karttan 800 avanslı → 'Tahsil
    Edilen 1.300 · Kalan 0', fazla 100, bakiye −100)."
  - Ana oturumun NOT'u (yorum, kural kaynağı DEĞİL — değerlendirildi): (1) reddin koşulu "kayıt işlendikten SONRA carinin (toplam) borcu < açık şüpheli tutar"; 'açık şüpheli tutar'ın bir kayıtla
    nasıl değiştiği önceki kararlardan; tür TEK biçimde çıkmıyorsa SUS ve sor; şüpheliye ALMA adımı aynen. (2) S158 alanı değer alır; Kalan, bakiye, gecikmiş etkilenmez. (3) S156 / S157 neden metni.
- **Birlikte okunan (kâhinin kendi belgesi):** bu dosyanın §8 C6 (ŞÜPHELİ KALAN, KS7 (b), K7), §13 C13.4 (3) / (4), §25 Y14-3 / Y14-4, §26 (bütünü — C00s, bakım 15 okuması, Y15-5 / Y15-6 / Y15-7 /
  Y15-14, SK-30 … SK-34, C26.4 / C26.5 / C26.8); `model.py` şüpheli (`_supheli_hesap`, `_supheli_olaylar`, `supheli_al`, `degersiz`), S145 (`_s145_adim`, `_s145_asim`, `_tarihli_kalemler`,
  `S145_DISI`), kart göstergeleri (`kontrol` — `pd` payları), `kart_tahsilat`, `kos`; `kos.mjs` yalnız `kart_tahsilat` eşlemesi (seçenek gönderilmiyor — S154 için); d41 / d42 / d43 elle senaryoları;
  `docs/kanit/2026-11-13/kahineski15-arac/` araçları. Okunan / okunmayan dosyaların tam listesi (satır aralıklarıyla) ajan raporunda.
- **Okunmayan:** `server/**`, `client/**`, `bulut/**`, `packaging/**`, `tools/**` (yalnız `kanit.mjs` çalıştırılır), `docs/erp/C5-ACILIS-TASARIM.md`, `docs/erp/C5B-TYK-TASARIM.md`, `docs/devir/**`,
  `docs/2.5.0-IS-LISTESI*.md` (hiçbir sürümü), `test/bagimsiz/cari/YAPIM-ASAMASI.json`, iki kâhin klasörü dışındaki `test/**`, başka ajanların `docs/kanit/**` dosyaları (yalnız `kahineski15-arac/`
  araçları), git farkı / geçmiş içeriği. Program koşulmadı. CLAUDE.md "Açık iş"teki program durumu kural / beklenti kaynağı sayılmadı.

### Kâhinin BUGÜNKÜ (bakım 15, `6453ad3b`) okuması — dört kararın alanında (açıkça)
- **S155 — bakım 15 TARİH ölçüsüyle okudu (§26 Y15-6 / C26.8):** yalnız TAHSİLAT adımı (`tahsilat`, `kart_tahsilat`) ve yalnız tarihi bir Şüpheli Alacak kaydının tarihinden ÖNCEYSE denetleniyordu:
  o kaydın GÜNÜNDE K1 ("tutar ≤ o günkü borç − o anda açık öbür kayıtların kalanı"; o günkü borç = önceki günlerin bütün satırları + o günün borç yönlü satırları) tahsilatla birlikte yeniden kurulup
  bozuluyorsa RET. Kararın örneğinde (yeni borç 500 şüpheliden SONRA) o günkü borç 1.000 − 300 = 700 < 900 → bakım 15 RET (bakiye 1.500) verirdi — S155'in B'si. Yanında: (SK-33) tahsilat DIŞINDAKİ
  adım (çek, elle Alacak, stok iadesi, borç silme / düzeltme, fatura iptali, Silinenler'den geri yükleme …) bir kaydın gününde YENİ aşım doğuruyorsa → iki dünya SUS; (SK-34 (a)) aşım tahsilattan
  ÖNCE zaten varsa → SUS; (SK-34 (b)) o günün borç yönlü satırlarının sayılışı kararı değiştiriyorsa → SUS; (SK-34 — "kurulamıyor") carinin tarihli borcu kurulamıyorsa (iade faturasının geri
  ödemesi — günü kâhinde yok) → SUS. Şüpheli tarihinden sonraki (aynı gün dahil) tahsilat ve borç yetiyorken önceye tahsilat KABUL; faturaya bağlı tahsilat (şüpheliden düşmez) şüpheli tarihinden
  SONRAYSA hiç denetlenmiyordu (kabul).
- **S158:** SUSUYOR — §26 Y15-7 / C26.5 SK-32: satış kartı OLMAYAN kartın taksitini S2 sırasıyla para DIŞI kapatıcı (faturasız stok iadesi, iade faturasının artanı, Değersiz) kapattıysa ya da satış
  kartında iade faturası artanı / Değersiz payı varsa `kart:<no>:odenen` ve `kart:<no>:taksit<i>:odenen` yazılmıyor; `kalan` yazılıyor. Kararın örneği d42 T7'dir (bakım 15 SK-32'nin kendi örneği).
- **S156 / S157:** SUSUYOR (SK-30 / SK-31 (a) / (b) / (c)); neden metni "KULLANICIYA SORULMALI SK-30 / SK-31".
- **S154:** alan yok / SUS — kâhinin dilinde 'Fazlasını Avans Yaz' seçeneği YOK: `kart_tahsilat {kayit, tutar, tarih}` seçenek taşımıyor (koşucu `kos.mjs` eşlemesi de yalnız tutar / tarih / nakit
  gönderiyor — okundu, değiştirilmedi). Kartın kendi tahsilatının fazlası ("kartfazla", C13.4 (3) — fazla kendi tarihinde BAĞSIZ alacak) olan kartta `odenen` S144 = C ile SUS.

### Yorumlar (ders 40 — kararlardan; kod yazılmadan ÖNCE; baş mimar kullanıcıya gösterir)
- **Y16-1 — S155: kural (TOPLAM ölçü):** şüpheli kaydı olan carilerde durum değiştiren HER adımdan sonra (türü fark etmez — bağsız / faturaya bağlı tahsilat, Taksit Tahsilatı, alınan çek / senet,
  elle Alacak, faturasız stok iadesi, iade faturası, Değersiz Alacak Yaz, borç kaydının silinmesi / tutarının ya da tarihinin değiştirilmesi, faturanın iptali / silinmesi, kartın silinmesi,
  Silinenler'den geri yükleme …): A' = carinin açık şüpheli tutarı (aşağıda Y16-2), B' = carinin bakiyesi (borç +). **A' > 0 ve B' < A'** ise ve bunu ADIM doğurduysa (adım normal bakiyeyi düşürdü:
  B' − A' < B − A; adımdan önce kural sağlanıyordu — sağlanmıyorsa Y16-4) adım REDDEDİLİR — hiçbir satır yazılmaz; Kasa, bakiye, şüpheli kalan değişmez; `adim:<id>:durum` "ret"
  (ret iletisi / kodu YAZILMAZ — karar ileti metnini / kodunu vermedi). **Tarih ölçüsü YOK** ("şüpheliye alma günündeki borca ayrıca BAKILMAZ"): şüpheli kaydının günündeki borç, aynı günün
  borcu, aşımın önceden olup olmadığı karar için ÖNEMSİZ — bakım 15'in SK-34 (a) / (b) ayrımları bu ölçüyle TEK sonuca iner. **Sınırlar (tek okuma):** tam eşitlik (B' = A') KABUL ("altına düşüyorsa"
  kesin küçük; S145'in d41 S5'i aynen); kısmi kabul yok (adım bölünmez — bakım 15 aynen). Kararın iki örneği AYNEN: borç 1.000 → şüpheli 900 → sonradan yeni borç 500 → şüpheli tarihinden önceye
  tahsilat 300: A' = 900 (önceye tarihli tahsilat şüpheliden düşmez), B' = 1.200 ≥ 900 → KABUL, bakiye 1.200; yeni borç yokken B' = 700 < 900 → RET, bakiye 1.000. Etiket KULLANICI.
- **Y16-2 — 'açık şüpheli tutar'ın bir kayıtla nasıl değiştiği (önceki kararlardan — §8 ŞÜPHELİ KALAN [PLAN §3.11b/2 (a)–(c), §3.11b/3; 2.3.0-SUPHELI-KABUL K1 / K3 / K7], §26 Y15-6):** A = Σ
  kayıt kalanları; kalan = alınan − şüpheliden düşen alacak satırları − Değersiz. Kayıt tarihinden SONRA (AYNI GÜN DAHİL) gelen alacak satırı — serbest (bağsız) tahsilat, alınan evrak, elle
  Alacak, iade faturası, satış iadesi (faturasız stok iadesi), taksit tahsilatı — ÖNCE şüpheliden düşer (en eski kayıttan); FATURAYA BAĞLI tahsilat ("Kapatılacak Fatura", (b)) kendiliğinden normal
  cari hesaba işlenir (DÜŞMEZ); kayıt tarihinden ÖNCE tarihli satır DÜŞMEZ (sonradan girilse de); Değersiz Alacak Yaz kendi kaydından düşer (≤ kalan, K7). Kâhinin bu kuralı bakım 15'te de
  tek biçimdi (S145'in soru metnindeki örnek de bunu söylüyor: "bugün tarihli tahsilat 300: bakiye 700, açık şüpheli 600; önceki tarihli tahsilat düşürmez"). **Sonuçları (türlere göre):**
  (a) kayıt gününde / sonrasında bağsız tahsilat, evrak, elle Alacak, iade faturası, stok iadesi, Taksit Tahsilatı, Değersiz: A ve B AYNI tutarda azalır (tutar ≤ kalan iken) → B − A değişmez →
  hiç RET olmaz (tutar kalanı aşarsa Y16-5). (b) kayıt tarihinden ÖNCE tarihli alacak satırı (hangi türden olursa olsun): A değişmez, B azalır → RET olabilir (kararın örnekleri; S145).
  (c) FATURAYA BAĞLI tahsilat (her tarihte): A değişmez, B azalır → RET olabilir (bakım 15'te şüpheliden SONRA tarihliyse hiç denetlenmiyordu — DEĞİŞİR; kâhinin önceki kararı (b) "kendiliğinden
  normal" + S155 "türü fark etmez"). (d) borç yönlü satırın silinmesi / azaltılması, faturanın iptali / silinmesi, kartın (Yeni Borç kartı) silinmesi: A değişmez, B azalır → RET olabilir (kararın
  sözü "borç silme"). (e) Silinenler'den geri yüklenen alacak satırı: kendi tarihinde yeniden girmiş sayılır — (a) / (b) / (c) gibi (kararın sözü "geri yükleme"). (f) alacak satırının tarihi kayıt
  tarihinden önceye alınırsa: düştüğü şüpheli tutar geri açılır, A artar, B aynı → RET olabilir. (g) borç yönlü satır (Borç, fatura, Ödeme, ciro, karşılıksız dönen evrak, kart …) ve şüpheliden
  düşmüş bir alacak satırının silinmesi: B artar (A en çok B kadar artar) → RET olmaz. **Faturaya bağlı EVRAK:** ŞÜPHELİ KALAN "alınan evrak"ı bağına bakmadan sayar ve istisnası yalnız "faturaya
  bağlı tahsilat (Kapatılacak Fatura)" — kâhinin bakım 6'dan beri okuması (mutant 121 yalnız bağlı tahsilat); S138'in sorusu da "şüpheliden DÜŞEN faturaya bağlı çek"i öncül alıyordu → bağlı evrak
  kayıttan sonra DÜŞER (tek okuma; S138 = C yalnız görünüm kalemini — hangi kalemden düştüğünü — BİLİNEN SINIR yaptı, düşüp düşmediğini değil).
- **Y16-3 — şüpheliye ALMA adımının kendisi (Y16-1'in dışında):** K1 aynen (§8 ŞÜPHELİ KALAN; `supheli_al`): "Şüpheli Alacağa Al tutarı ≤ cari borç bakiyesi − açık kayıtların kalanı" — bugünkü
  (toplam) bakiyeyle; şüpheliye alma tarihi geriye olsa da o günün borcuna bakılmaz (kâhin bakım 6'dan beri böyle; karar yeni bir şey söylemiyor — NOT (1)). Y16-1'in denetimi `supheli_al`'a ayrıca
  uygulanmaz (K1 ondan sıkı: B ≥ A + tutar). Denetlenmeyen öbür adımlar (para satırı yazmayan ya da bütün durumu kendi kuralıyla kuran): cari açma, kullanıcı açma, yedek alma, YEDEKTEN geri yükleme
  (bütün durum yedeğin anına döner — o an kural sağlanıyordu), dönem kilidi, sunucu yeniden başlatma, tablo yükleme (bakım 15'in `S145_DISI`'si aynen).
- **Y16-4 — adımdan ÖNCE zaten bozuk kural (kâhinin sınırı):** Y16-1 her adımda uygulandığından ve `supheli_al` K1'i sağladığından adımdan önce B − A < 0 iken A > 0 olması yalnız denetlenmeyen
  bir yoldan doğabilir (beklenen sayısı 0). Böyle bir carideki adım normal bakiyeyi düşürüyorsa (B' − A' < B − A) kâhin kabul / reddi BİLMEZ (karar "düşüyorsa" — önceden altındaysa ne olacağını
  söylemiyor) → iki dünya SUS (bakım 15 düzeni), neden "kâhinin sınırı (Y16-4)"; düşürmüyorsa kabul. Geliştirme koşularında sayısı raporlanır.
- **Y16-5 — SK-35: adım açık şüpheliyi SIFIRLIYOR ve carinin bakiyesi eksiye iniyor (karar SUSUYOR — SUS ve sor):** örnek: borç 1.000 → şüpheli 900 → bugün tarihli tahsilat 1.100: 900'ü şüpheliden
  düşer (A' = 0), bakiye B' = −100. Okuma 1 ("açık şüpheli kalmadı — kural bağlamaz"): KABUL, bakiye −100 (100 avans). Okuma 2 (harfi: "carinin borcu (−100) açık şüpheli tutarın (0) altına
  düşüyor"): RET, bakiye 1.000, açık şüpheli 900. Kâhin: adımdan ÖNCE A > 0, sonra A' = 0 ve B' < 0 → iki dünya SUS, neden "KULLANICIYA SORULMALI SK-35". BAKİYE OKUMALAR ARASINDA FARKLI
  (ders 43). **DÜZELTME (kod yazılırken görüldü, yorum commit'inden SONRA — açıkça):** yorum commit'inde ikinci bir alt durum da SUS yazılmıştı — kayıtları ÖNCEDEN kapanmış (tamamı tahsil /
  Değersiz) caride bakiyeyi eksiye indiren adım (A = A' = 0, B' < 0). Rastgele s1'in ilk koşusunda bu SUS 10 tohumun 8'inde onlarca adımı (avanslı cariler) iki dünyaya düşürdü; okuma yeniden
  tartıldı: açık şüpheli tutarı 0 olan cari, şüpheli kaydı HİÇ olmayan cariyle karar metni açısından aynıdır ("açık şüpheli tutarın altına" — açık tutar yok); harfi okuma ("borç < 0 = açık
  şüpheli") o cariye uygulanırsa her carinin avansını da yasaklardı, karar bunu söylemiyor → TEK okuma: A = A' = 0 iken kural BAĞLAMAZ (kabul). Kâhinin önceki kararı değişmedi; değer kâhine
  göre değil, okuma karar metnine göre düzeltildi (d44 X13 elle tablosu da düzeltildi: KABUL, bakiye −100). SK-35'te (A > 0 → A' = 0) ise adım açık bir şüpheli kaydını kapatıyor —
  'adımdan önce açık' ↔ 'adımdan sonra açık' hangisine bakılacağı kararda yok → SUS kalır.
- **Y16-6 — bakım 15'te SK-33 / SK-34 ile susturulan adımlar (açıkça):** **değer alır** — SK-33 bütünü (tahsilat dışı adım: alınan çek / senet, elle Alacak, faturasız stok iadesi, iade faturası,
  borç kaydının silinmesi / düzeltilmesi, faturanın iptali / silinmesi, Silinenler'den geri yükleme; rastgele s1'deki `hareket_sil` / `hareket_geri_yukle` iki dünyaları), SK-34 (a) (aşım önceden
  var — artık yalnız adımdan SONRAKİ toplam ölçü), SK-34 (b) (aynı günün borcu — ölçüde tarih yok), SK-34 "kurulamıyor" (iade faturasının geri ödemesi — toplam ölçü tarihli borç istemez). **Hâlâ
  SUS:** yalnız Y16-4 (önceden bozuk — kâhinin sınırı; beklenen 0) ve yeni SK-35 (Y16-5). Gerekçe: karar tek ölçü verdi ve 'açık şüpheli'nin kayıtla değişimi önceki karardan tek biçimde çıkıyor
  (Y16-2); SK-35 ve Y16-4 kararın cümlesinin iki okumaya açık kaldığı yerler.
- **Y16-7 — S155 × görünüm (§25 / §26 — değişmez):** RET edilen adım hiçbir satır yazmaz → o carinin bütün denetimleri adım yokmuş gibi (S130 görünümü, gecikmiş, Kalan, Kasa …). KABUL edilen adım
  §25 / §26'nın kurallarıyla (S130 R, S136, S139; R kalemlerin toplamını aşarsa Y14-4 "bütün kalemler 0" — kararın örneğinde A' = 900 ≤ B' 1.200 olduğundan oluşmaz; Y16-1 her adımda B' ≥ A'
  tuttuğundan R ≤ bakiye — Y14-4'ün o kolu artık yalnız SUS dünyalarında). Mizan, yevmiye: ret yazmaz.
- **Y16-8 — S158: kapsam:** HER taksit kartında (Taksitler'den Mevcut Borç / Yeni Borç kartı, Tablodan Aktar kartı, stoktan taksitli satışla açılan kart; taksitli satış faturasının kendi kartı
  kâhinde kart göstergesi taşımaz — C13.4 (1)) `kart:<no>:odenen` ('Tahsil Edilen') ve `kart:<no>:taksit<i>:odenen` ('Ödenen') = taksitin tek yükümlülük kuyruğunda (S129) kapanan kısmından
  para DIŞI kapatıcıların kapattığı kısım ÇIKARILARAK: **faturasız stok iadesi** ve **Değersiz Alacak Yaz** (kararın sözü) ve **iade faturasının artanı** (S151'in kendi metni "İade faturasıyla yapılan
  iadede kart küçülür, Tahsil Edilen 0" + S158 "her kartta" + soru metni "iade ve Değersiz yazma tahsilat sayılmaz" — iade faturası da iadedir; tek okuma). 'Kalan' (`kart:<no>:kalan`) = tutar −
  taksitlerin kuyrukta kapanan BÜTÜN kısmı (para dışı dahil) — DEĞİŞMEZ (kararın örneği: "Kalan 600"). Bakiye, gecikmiş, takvim / Vade Takip / projeksiyon kalemleri, fatura açığı DEĞİŞMEZ (NOT (2)).
  Kararın örneği AYNEN = d42 T7: Borç 900 → Taksitler'den kart 900 (3 × 300) → faturasız stok iadesi 300 ⇒ 'Tahsil Edilen 0', 'Kalan 600', taksit 'Ödenen' 0 / 0 / 0, bakiye 600. Satış kartında
  Değersiz / iade faturası artanı payı da aynı kuralla (bakım 15'te SK-32 SUS idi). Aynı kartta para (tahsilat / evrak) + para dışı: 'Tahsil Edilen' yalnız para (d42 T6 düzeni). Etiket KULLANICI.
  **SUS kalanlar (değişmez):** kartın kendi tahsilatının fazlası (S144 = C — `odenen`), karşı yönlü kalemli kartlı cari (S143 = C — `kalan`), SK-31 (S157 = C), C13.4 (11) tanımsız cari.
- **Y16-9 — S154 ↔ S144 (c): sınır:** S154 'Fazlasını Avans Yaz' yolunu kurala bağladı ('Tahsil Edilen' = karttan alınan paranın tamamı). Kâhinin dilinde bu YOL (seçenek) yok: `kart_tahsilat`
  seçeneksiz, fazlası kendi tarihinde BAĞSIZ alacak (C13.4 (3)); koşucu da seçenek göndermiyor. Kâhinin kart tahsilatı fazlasının programda hangi yola (Fazlasını Avans Yaz mı, başka bir yol mu)
  karşılık geldiği kâhinin belgelerinden TEK biçimde çıkmıyor (ana oturumun notu: "S144 (c)'nin kapsadığı ÖBÜR alt durumlarda susman sürer") → S144 (c) SUS AYNEN; neden metnine "S154 = B ('Fazlasını
  Avans Yaz' yolu) kâhinin dilinde ayrı adım değil — sınır ana oturumda" eklenir; değer YAZILMAZ. Ana oturuma: `kart_tahsilat`'a seçenek alanı (ör. `avansYaz: true`) ve koşucu eşlemesi eklenirse
  (ayrı bakım) S154 o adımda değer alır: 'Tahsil Edilen' = Σ karttan alınan, 'Kalan' 0, bakiye − fazla.
- **Y16-10 — S156 = C / S157 = C:** SK-30 ve SK-31 (a) / (b) / (c) SUS AYNEN; neden metinleri "… BİLİNEN SINIR (kullanıcı kararı S156 = C) S156 (§27 Y16-10; SK-30)" ve "… BİLİNEN SINIR (kullanıcı
  kararı S157 = C) S157 (§27 Y16-10; SK-31 (a) | (b) | (c))" (KULLANICIYA SORULMALI değil).
- **Y16-11 — DEĞİŞMEYEN:** şüphelisiz carilerin bütün denetimleri; şüpheli kayıtlı caride adımı RET olmayan / SUS olmayan bütün denetimler (§25 / §26); kart 'Kalan'ı; S136 / S139 / S140 / S151'in
  (satış kartındaki stok iadesi) değerleri; S137 / S138 / S141 / S143 / S144 / S149 SUS'ları; `--kural 2.4.9` ve öncesi.

### Dört kararın alt durumları (açıkça)
| Alt durum | Bakım 15 | Bakım 16 |
|---|---|---|
| S155: şüpheli tarihinden önceye tahsilat, toplam borç YETİYOR ama o günkü borç yetmiyor (kararın KABUL örneği) | DEĞER = B (RET) | **DEĞER = A (KABUL)** |
| S155: şüpheli tarihinden önceye tahsilat, toplam borç yetmiyor (kararın RET örneği; d41 S1, d39 N11) | DEĞER (RET) | DEĞER (RET — aynen) |
| S155: tahsilat dışı adım (çek, Alacak Yaz, stok iadesi, iade faturası, borç silme, geri yükleme, tarih değişikliği) | SUS (SK-33) | **DEĞER** (toplam ölçü) |
| S155: aşım önceden var / aynı günün borcu (SK-34 (a) / (b)) / tarihli borç kurulamıyor | SUS (SK-34) | **DEĞER** (toplam ölçü) |
| S155: faturaya bağlı tahsilat şüpheli tarihinden SONRA, normal bakiyeyi aşıyor | DEĞER (kabul — denetlenmiyordu) | **DEĞER (RET)** |
| S155: tam eşitlik / şüpheli tarihinden sonraki tahsilat (A ile B birlikte düşer) | DEĞER (kabul) | DEĞER (kabul — aynen) |
| S155: adım açık şüpheliyi sıfırlıyor, bakiye eksiye | DEĞER (kabul) | **SUS** — KULLANICIYA SORULMALI SK-35 |
| S155: kayıtları önceden kapanmış caride bakiye eksiye (avans) | DEĞER (kabul) | DEĞER (kabul — kural bağlamaz; Y16-5 düzeltmesi) |
| S155: adımdan önce kural zaten bozuk (yalnız denetlenmeyen yoldan) | — | SUS — kâhinin sınırı (Y16-4) |
| S158: satış kartı olmayan kartta stok iadesi / iade faturası artanı / Değersiz payı; satış kartında iade faturası artanı / Değersiz | SUS (SK-32) | **DEĞER = A** (para dışı pay sayılmaz) |
| S156 (SK-30) / S157 (SK-31 (a) / (b) / (c)) | SUS (KULLANICIYA SORULMALI) | SUS — BİLİNEN SINIR (metin) |
| S154 ('Fazlasını Avans Yaz' yolu) | alan yok (S144 (c) SUS) | alan yok — S144 (c) SUS AYNEN (metin) |

### KULLANICIYA SORULMALI (bakım 16; kâhin bu durumlarda SUSAR — ders 43, SORU DÜZENİ)
- **SK-35 (S155'in sınırı — UÇ DURUM; BAKİYE OKUMALAR ARASINDA FARKLI):** adım açık şüpheliyi sıfırlıyor ve bakiye eksiye iniyor: borç 1.000 (01.05) → 16.05 Şüpheli 900 → bugün tahsilat 1.100.
  **A (öneri — 'açık şüpheli kalmadı, kural bağlamaz'; şüpheliye alınmamış cari gibi):** KABUL — 900 şüpheliden, 200 normal cariye; bakiye −100 (100 avans), açık şüpheli 0 / **B (kararın harfi —
  borç −100 < açık şüpheli 0):** RET — bakiye 1.000, açık şüpheli 900, Kasa'da 1.100 yok. **C:** uç durum böyle kalsın (BİLİNEN SINIR — kâhin susar). (Yorum commit'indeki (b) — kayıtları önceden
  kapanmış caride avans — Y16-5 DÜZELTMESİ ile soru olmaktan çıktı: kural bağlamaz, kabul.)

### Kurallar (kod commit'i; yorumların `model.py`'deki karşılığı)
- **C27.1 S155 `_s145_adim` (Y16-1 / Y16-3 / Y16-4 / Y16-5):** bakım 15'in tarih ölçülü gövdesinin YERİNE: şüpheli kaydı olan kâhinde `S145_DISI` dışındaki her adımda, şüpheli kayıtlı her cari için adımdan
  önce (A, B) ve sonra (A', B') — A = `_s155_acik` (ŞÜPHELİ KALAN `supheli_durum` aynen), B = `bakiye`. B' − A' ≥ B − A → dokunulmaz; A' > 0, B' − A' < 0 → adımdan önce A > 0 ve B − A < 0 ise SUS
  ("Y16-4", kâhinin sınırı), değilse RET (durum geri alınır — bakım 15'in kopya / geri alma düzeni AYNEN; `("ret", "KULLANICI", "§27 Y16-1 S155 A …")`); A > 0, A' = 0, B' < 0 → SUS "SK-35". A = A' = 0
  → kural bağlamaz (Y16-5 düzeltmesi). SUS adımları `sus_s145` → `kos` sonunda iki dünya (bakım 15 düzeni); adımsız dünyada SUS adımının kurduğu kayda başvuran sonraki adımlar da çıkar (yoksa
  o dünya kurulamıyordu — geliştirme sırasında rastgele s1 tohum 4'te karşılıksız dönen çekin kendisi SUS adımıyken görüldü; Y16-5 düzeltmesinden sonra rastgelede SUS kalmadı, düzen durur).
  `belirsiz`: "adım <id>: cari <ad> S155 — …: … KULLANICIYA SORULMALI SK-35 (§27 Y16-5)" | "… kâhinin sınırı (§27 Y16-4)". `_s145_asim` / `_tarihli_kalemler` yalnız mutant 299 için durur.
- **C27.2 S158 `kontrol` kart göstergeleri (Y16-8):** her kartta `pd` (para DIŞI pay — "stok" faturasız stok iadesi, "iade" iade faturasının artanı, "deg" Değersiz) `odenen` / `taksit<i>:odenen`'den
  çıkarılır; `kalan` aynen. SK-32 susması KALKTI. Ek metin satış kartında yalnız stok iadesi varsa "§26 Y15-7 S151 B …" (bakım 15 aynen), öbür durumda "§27 Y16-8 S158 A …"; etiket KULLANICI.
- **C27.3 neden metinleri (Y16-9 / Y16-10):** SK-30 → "BİLİNEN SINIR (kullanıcı kararı S156 = C) S156 (§27 Y16-10; SK-30)"; SK-31 (a) / (b) / (c) → "BİLİNEN SINIR (kullanıcı kararı S157 = C) S157
  (§27 Y16-10; SK-31 (x))"; S144 = C → "… S144 — S154 = B ('Fazlasını Avans Yaz' yolu) kâhinin dilinde ayrı adım değil (§27 Y16-9)". Susma alanları DEĞİŞMEDİ.
- **C27.4 iz:** `_iz15`'e "s155ret", "s155sus", "s158" (sonucu değiştirmez; G3 sınıflaması).
- Mutantlar (`MUTASYONLAR`): **293–296 yeni anlamıyla** — 293 tahsilat (bağsız / bağlı / Taksit Tahsilatı) hiç reddedilmez (öbür türler denetlenir); 294 eşitlikte de ret; 295 kaydın günündeki alacak satırı
  denetimde şüpheliden düşmemiş sayılır; 296 şüpheli tarihinden önceki her tahsilat ret (toplam borç yetse de — S155'te bu artık "tarih ölçüsünün en katı biçimi"dir; bakım 15'te "yarım uygulama"
  idi). **Yeni 299–302:** 299 S155 B (TARİH ölçüsü — bakım 15'in `_s145_asim`'i, her adım türünde, toplam ölçü yok) · 300 S155 yarım (toplam ölçü yalnız tahsilatta; çek / Alacak Yaz / iade / borç silme
  / geri yükleme kabul) · 301 S158 B (satış kartı OLMAYAN kartta iade / Değersiz sayılır) · 302 S158 yarım (yalnız stok iadesi sayılmaz).
- `--kural 2.4.9` / 2.4.6 / 2.4.5 / `--legacy`: hiçbir yol değişmedi (`_s145_adim` yalnız `k250` ve şüpheli kaydı varken; kart göstergesi değişikliği `k250` dalında).

### C8t Nasıl bozulur? (bakım 16 — kod commit'inde, senaryolarla birlikte yazıldı)
| # | Bozulma | Senaryo |
|---|---|---|
| Z186 | Tarih ölçüsü (S155 B): sonradan doğan borç varken önceye tahsilat RET | d44 X1 (mutant 299) |
| Z187 | Toplam borç yetmiyorken önceye tahsilat KABUL (S145 B) | d44 X2, d41 S1 / S6, d39 N11 (mutant 293) |
| Z188 | Tahsilat dışı tür denetlenmez (çek, Alacak Yaz, borç silme, stok iadesi, geri yükleme, tarih değişikliği) | d44 X3 / X4 / X5 / X10 / X11 / X14, d41 S7 (mutant 300) |
| Z189 | Faturaya bağlı tahsilat şüpheliden düşmüş sayılır ya da denetlenmez | d44 X9 (mutant 121, 293, 299) |
| Z190 | Eşitlikte / borç yetiyorken / şüpheliden sonraki tahsilatta RET | d44 X6 / X7 / X8, d41 S2 … S5 / S8 / S9 (mutant 294, 296) |
| Z191 | Aynı günün tahsilatı şüpheliden düşmemiş sayılır | d41 S3 (mutant 295) |
| Z192 | Açık şüpheliyi sıfırlayıp eksiye inen adımda değer uydurulur; kapanmış kayıtlı caride avans reddedilir | d44 X12 (SK-35 SUS), X13 (kabul) |
| Z193 | Satış kartı olmayan kartta iade / Değersiz 'Tahsil Edilen' / 'Ödenen' sayılır; Değersiz sayılır | d42 T7, d44 Y2 / Y4 / Y5 (mutant 301, 302) |
| Z194 | Satış kartında S151 değeri değişir | d42 T1 / T2 / T3 / T6 (mutant 297, 298) |
| Z195 | Adımsız dünya, SUS adımına başvuran sonraki adımda çöker | rastgele s1 (geliştirme sırasında tohum 4) |

### Senaryolar (bakım 16; elle tablolar — kâhin koşulmadan karar metinlerinden ve §27'den; betik `docs/kanit/2026-11-13/kahineski16-arac/yeni-senaryolar16.py`)
- **`d44-c5-s155-s158`** (bugün 15.06.2026; 73 elle denetim): **S155 kararın iki örneği AYNEN** (günler kararın sözüyle: 60 gün önce 16.04, 40 gün önce 06.05, 30 gün önce 16.05, 10 gün önce 05.06) —
  X1 borç 1.000 → şüpheli 900 → yeni borç 500 → önceye tahsilat 300: KABUL, bakiye 1.200, Kalan 700 / 500 · X2 yeni borç yokken RET: bakiye 1.000, Kalan 1.000, gecikmiş 100, görünüm toplamı 100. Aynı
  örnekte RET: X3 alınan çek, X4 Alacak Yaz, X5 borç silme (700 + 300 → 300 silinir), X11 faturasız stok iadesi, X10 Silinenler'den geri yükleme (alacak silinir → şüpheli → geri yüklenir), X14 tarih
  değişikliği (şüpheliden sonra alacak 300 KABUL — düşer; tarihi önceye alınınca RET, bakiye 700); X9 faturaya bağlı tahsilat şüpheliden SONRA (düşmez) RET. KABUL: X6 borç yetiyor (şüpheli 600, önceye
  tahsilat 300 → 700 ≥ 600; görünüm 100), X7 tam eşitlik (600 = 600; görünüm 0, gecikmiş 0), X8 şüpheliden sonraki tahsilat (açık şüpheli 900 → 600; bakiye 700, görünüm 100). SK-35: X12 (bugün tahsilat
  1.100 — SUS; durum ve bakiye yazılmaz). X13 kayıtları Değersiz 900 ile kapanmış caride Alacak Yaz 200 → KABUL, bakiye −100 (Y16-5 düzeltmesi). **S158 komşuları:** Y2 Değersiz yazma (Borç 900 →
  kart 900 → şüpheli 300 → Değersiz 300: 'Tahsil Edilen 0', 'Kalan 600', taksit 'Ödenen' 0 / 0 / 0, bakiye 600) · Y4 Taksit Tahsilatı 300 + stok iadesi 300 ('Tahsil Edilen 300', 'Kalan 300', taksit
  300 / 0 / 0) · Y5 satış kartında Değersiz (bakım 15'te SK-32 SUS — 'Tahsil Edilen 0', 'Kalan 600').
- **`d41` (karar gereği güncellendi):** S7 (önceye tarihli çek 300; bakım 15'te SK-33 SUS) → RET, bakiye 1.000, Kalan 1.000, gecikmiş 100; S8 (bakım 15 SK-34 (a)) → KABUL, bakiye 950; S9 (SK-34 (b)) →
  KABUL, bakiye 1.100 (o günün borcuna bakılmaz); R7'nin nedeni S156 = C. **`d42`:** T7 (S158'in kendi örneği; bakım 15 SK-32) 'Tahsil Edilen 0', taksit 'Ödenen' 0 / 0 / 0; T4 / T5 / T8 nedeni S157 = C.
- **Bakım 15'in tarih ölçüsüne dayanan elle beklentileri (tek tek):** d41 S1 (RET — toplam 700 < 900, DEĞİŞMEDİ), S2 / S3 / S4 / S5 (KABUL — DEĞİŞMEDİ), S6 (Taksit Tahsilatı RET — toplam 200 < 400,
  DEĞİŞMEDİ), S7 / S8 / S9 (SUS → değer, yukarıda — S155 A), d39 N11 (RET — toplam 200 < 500, DEĞİŞMEDİ). Bakım 15'te tarih ölçüsüyle RET olup toplam ölçüyle KABUL olan elle beklenti YOKTU (o ayrımı
  ilk kez d44 X1 deniyor).
- **Elle tablo düzeltmesi (açıkça; ilk koşu):** d44'ün ilk elle tablosunda X14'te `hareket:x14a:kalan` 700 yazılmıştı — YANLIŞ el hesabı: elle Alacak KS2 gereği borcu kapatmaz (§8 (c), karşı yönlü
  kalem — C16.2); kâhin ilk koşuda o anahtarı YAZMADI ("ANAHTAR YOK"); değer kâhine uydurulmadı, anahtar elle tablodan ÇIKARILDI. Öbür 72 elle denetim ilk koşuda kâhinle aynıydı. X13'ün beklentisi
  Y16-5 düzeltmesiyle (kâhin koşusundan ÖNCE, okuma düzeltilerek) SUS'tan KABUL'e çevrildi.

### C10t Mutantlar (bakım 16; `oz-test.py` DEĞERLE — çökmeden, elle tablo kırmızı)
293 (d44 X2 / X9, d41 S1 / S6, d39 N11) · 294 (d44 X7, d41 S5) · 295 (d41 S3) · 296 (d44 X1 / X6 / X7, d41 S4 / S5 / S8 / S9) · 297 (d42 T1 / T2 / T3 / T6, d44 Y5) · 298 (d42, d44 Y2 / Y4 / Y5) · 299 (d44 X1 /
X9) · 300 (d44 X3 / X4 / X5 / X10 / X11, d41 S7) · 301 (d42 T7, d44 Y2 / Y4) · 302 (d44 Y2 / Y5). 296'nın anlamı: bakım 15'te "yarım uygulama" (önceki her tahsilat ret); S155'te tarih ölçüsünün en katı
biçimi — yakalayanı artık kararın KABUL örneği (X1) de. Bakım 6 … 15 mutantları (241–292) aynen yakalanıyor (`oz-test.py`; `mutant-senaryo.py` 261–302 × d35 … d44).

### Dil ekleri (/3, bakım 16)
Yeni adım YOK; yeni çıktı anahtarı YOK. 2.5.0'da durum değiştiren HER adım (şüpheli kaydı olan kâhinde) S155 ile "ret" dönebilir (`adim:<id>:durum`). Satış kartı olmayan kartta `kart:<no>:odenen` /
`taksit<i>:odenen` para dışı kapatıcıyla da yazılır. `belirsiz`: "adım <id>: cari <ad> S155 — … KULLANICIYA SORULMALI SK-35 (§27 Y16-5)" | "… kâhinin sınırı (§27 Y16-4)"; SK-30 / SK-31 / S144
metinleri C27.3.

### Eşleme notları (ana oturum için; `kos.mjs` bu bakımda DEĞİŞMEDİ — yalnız `kart_tahsilat` eşlemesi okundu)
- Yeni adım yok; d44 mevcut adım türleriyle (`cari_ac`, `borc`, `alacak`, `tahsilat {fatura?}`, `fatura`, `evrak`, `supheli_al`, `degersiz`, `stok_iade`, `hareket_sil`, `hareket_geri_yukle`,
  `hareket_duzenle {tarih}`, `kart_ac {mevcut}`, `kart_tahsilat`, `stok_satis_taksit`). S155'in reddi adımın durumudur — ret yanıtı (HTTP kodu / ileti) karar metninde yok; koşucu adımı "ret"
  okuyabilmeli (iletisi denetlenmez). `hareket_duzenle` / `hareket_sil` / `hareket_geri_yukle` / `evrak` / `alacak` / `stok_iade` adımlarının "ret" okunması da gerekir (bakım 15'te yalnız tahsilat).
- **S154:** `kart_tahsilat` seçenek taşımıyor (eşleme yalnız tutar / tarih / nakit) — 'Fazlasını Avans Yaz' için ayrı alan + eşleme gerekirse ayrı bakım (Y16-9).
- **Ana oturuma:** `model.py` değişti — mobil yazma kâhininin `cari_model_sha256`'sı yeniden üretilmeli (o dosya okunmadı); yapım aşaması listesi bu ajanca açılmadı (S155 / S158 alanındaki yeni
  değerler ve kalkan SUS'lar listede DEĞİŞEN / YENİ / KAPANAN kayıt olarak görünebilir — ayrıştırma ana oturumda).

### C12t DENENMEYEN (bakım 16; neden)
- Program koşulmadı (görev). Programın S155 / S158 alanındaki gösterimi ve ret iletisi bilinmiyor.
- S155: birden çok açık şüpheli kaydı olan caride ret; Değersiz yazılmış kayıtla önceye tahsilat; iade faturası (asıl faturaya bağlı) önceye tarihli; kartın silinmesi; faturanın iptali / silinmesi ve
  karşılıksız dönen evrak (borç artırır — RET olmaz) elle senaryoda YOK (yalnız rastgele s1'in `hareket_sil` / `hareket_geri_yukle` / `karsiliksiz` adımları). Y16-4 (önceden bozuk) hiçbir senaryoda
  oluşmadı (yolu bilinmiyor). Havale tahsilatı (nakitten ayrı) elle senaryoda yok.
- S158: iade faturasının artanının satış kartı olmayan kartı kapattığı elle senaryo yok (yalnız kural + mutant 302'nin Değersiz kolu). Taksitli satış faturasının kendi kartı (kart göstergesi yok).
- S154: alan yok (Y16-9). İki şirket / yedek geri yükleme / silinen şüpheli kaydı ile bu bakımın kuralları.

### C0t Değişen eski beklentiler (G3; bakım 15 (`6453ad3b`) ↔ bakım 16 kâhin çıktısı, `2.5.0`; eski kopyanın 97 elle senaryosu + d44 + rastgele s1 / ux18 tohum 1–10 × 120) — kararla ilgisiz eski beklenti DEĞİŞMEDİ
Eski 49.425 → yeni 49.774 denetim; değişen / kalkan / yeni toplam **390**; **BEKLENMEYEN 0**; yalnız etiketi değişen 0 (dökümü `docs/kanit/2026-11-13/kahineski16-g3-dokum-*.json` — iki saat diliminde
bayt bayt aynı; özet `kahineski16-esdeger-cari-*.log`). Sınıf İKİ modelin `_iz15` izinden cari cari (eski: s145ret / s145sus; yeni: s155ret / s155sus / s158); anahtar türü sınıfın alanında olmak zorunda:
- **S155 (327: 297 yeni + 23 değişen + 7 kalkan):** d41 33 yeni (S7 / S8 / S9 — bakım 15'in SK-33 / SK-34 iki dünyası değer aldı); d44 57 yeni + 23 değişen + 7 kalkan (eski kâhin d44'te tarih ölçüsüyle: X1 RET
  bakiye 1.500 → KABUL 1.200; X9 KABUL → RET; SK-33 alanındaki X3 / X4 / X5 / X10 / X11 / X14 SUS → RET; X12 eski KABUL → SK-35 SUS — 7 kalkan); rastgele s1 tohum 3 / 8 / 9 / 10 (66 + 61 + 74 + 6 yeni —
  bakım 15'in SK-33 iki dünyası (`hareket_sil` / `hareket_geri_yukle`): yedi adımın HEPSİ toplam ölçüyle KABUL (s1-3 s024 / s094, s1-8 s058, s1-9 s059 / s078, s1-10 s075 / s090); rastgele RET yok).
- **S158 (15 yeni):** d42 T7 4 (kararın örneği), d44 Y2 / Y4 / Y5 11.
- **GENEL (46 yeni + 2 kalkan):** aynı kontrolde sınıflı değişiklik olan senaryoda Kasa / Kasa raporu / sayaç (iki dünya düzeninin eski kâhinde sildiği cari dışı denetimler geri geldi; d44'te X12'nin
  SUS dünyası Kasa'yı ayırır — 2 kalkan).
- **Öbür 95 eski elle senaryo ve 16 rastgele: fark 0** (adımları değişen eski senaryo 0; bakım 15'in S136 / S139 / S140 / S141 / S143 / S144 / S149 / S151 alanları DEĞİŞMEDİ).
- **Eski ELLE tablolarda değişen beklentiler** (`kahineski16-elle-fark-*.log`, 97/97 izinli): d41 21 (S7 / S8 / S9 elleYok'tan değere 8 + 8 elleYok kalktı; SK-33 / SK-34 belirsiz kayıtları kalktı; R7 nedeni
  S156 = C), d42 15 (T7 'Ödenen'ler elleYok'tan 0'a; SK-32 kaydı kalktı; T4 / T5 / T8 nedeni S157 = C). Öbür 95 dosya ve bütün dosyaların adımları AYNI.
- `--kural 2.4.9` / 2.4.6 / 2.4.5 / `--legacy`: **472/472 bayt bayt aynı** (97 eski elle + d44 + 20 rastgele × 4 kip); üretici 20/20 aynı dizi.
- **Yeni / değişen elle tablolar ESKİ (bakım 15) kâhinde — beklenen NEDENLE kırmızı (ders 7, 38):** 272 elle denetimin **50**'si (`kahineski16-kirmizi-eski-cari-*.log`; d44 34, d41 9, d42 7):
  tarih ölçüsü (X1 RET, bakiye 1.500, Kalan 1.000), SK-33 / SK-32 alanında "ANAHTAR YOK" (X3 / X4 / X5 / X10 / X11 / X14, S7 / S8 / S9; KY2 / KY4 / KY5 / KT7 'Ödenen'leri), bağlı tahsilat KABUL (X9 bakiye
  700), SK-35 alanında değer (X12 KABUL, bakiye −100), yeni neden metinleri (S156 / S157 = C, SK-35) `belirsiz`'de yok; 222'si iki kâhinde aynı.

### Kanıt (bakım 16; iki saat dilimi — UTC ve Europe/Istanbul çıktıları başlık / kanit satırları dışında bayt bayt aynı; kâhin `72783564`, temiz ağaç; koşuyu ana oturum yaptı — kilit bu ajanın koşusu sırasında doluydu; `docs/kanit/2026-11-13/kahineski16-*`, araçlar ve koşu betiği `kahineski16-arac/`)
cari öz test **6.373/6.373** (`-cari-oz-*`: elle tablolar 98 senaryo, mutantlar 200–302 — 219–302 değerle) · mutasyon taraması **269/269** (`-cari-mutasyon-*`) · eşdeğerlik + G3 **590/590** (`-esdeger-cari-*`) ·
yeni / değişen elle tablo **272/272** (`-elle-yeni-cari-*`: d44 73 + d41 126 + d42 73) · ESKİ kâhinde **50 kırmızı** / 272 (`-kirmizi-eski-cari-*`) · eski elle tablo farkı **97/97** izinli (`-elle-fark-*`) · G1
tarama **98/98** (`-g1-tara-*`) · mutant ↔ senaryo **420/420** (`-mutant-senaryo-*`; d35 … d44 × 261–302) · geniş tarama **2.201/2.201** (`-genis-tarama-*`; bakım 15 ile aynı sayı) · defter öz testi **181/181**
(`-defter-oz-*`; bu bakım defter kâhinine dokunmadı). Öz test, mutasyon, eşdeğerlik ve geniş tarama `flock -s -n …/olcum.lock` ile (ders 52); her adım `timeout` sınırlı. Program açılmadı. Koşu
günlükleri `kahineski16-kos-utc.txt` / `-ist.txt` (yük 0,87 / 1,45 — 4 çekirdek). `s155-say.py` (RET / SUS sayıları + değişmez) bu koşuda YOK — ana oturumun isteğe bağlı ek komutu.

## 28. 2.5.0 Ç5 bakımı 17 — S159 (açık şüpheli kalmadıysa S155 bağlamaz) + karttan tahsilat adımına 'Fazlasını Avans Yaz' seçeneği (S118 = B'nin sınırı, S154 = B değer alır) + S162 = B / S163 = C (BİLİNEN SINIR — susma) + S150 (BAŞ MİMAR YORUMU) (13.11.2026, `date -u` 17:22; kararlar 13.11.2026 10:40 / 16:11 UTC ve S118 / S154 — ana oturumun özet dosyası; eski kâhinler bakımı 17 — kodu görmeyen AYRI el; KÜÇÜK bakım, TOPLU KÂHİN BAKIMI) — kural seti `2.5.0` = §13 + … + §27 + bu bölüm

Bu bakım: S159 = A (bakım 16'nın SK-35 sorusu), bakım 16 raporunda "ayrı bakım" denen adım seçeneği (karttan tahsilat adımı 'Kalanı Aşan Tutar' sorusunun yanıtını taşır — S118 = B'nin
sınırı; S154 = B'nin 'Fazlasını Avans Yaz' yolu değer alır), S162 = B ve S163 = C (BİLİNEN SINIR — kâhin o alt durumlarda SUSAR) ve S150 = A için baş mimar yorumu. §13–§27'nin öbür kuralları
DEĞİŞMEZ. `--kural 2.4.9` (ve 2.4.6 / 2.4.5 / `--legacy`) AYNEN (seçenek alanı ≤ 2.4.9'da okunmaz — kart tahsilatı her tutarda kabul, fazlası bağsız: B1.2 / C13.4 (3) aynen). Defter kâhini
(`test/bagimsiz/defter/`) DEĞİŞMEZ (reddedilen adım yevmiye yazmaz; S159 kabulü tahsilatın kendi maddesidir; S162 / S163 bakiyeyi ve yevmiyeyi değiştirmez). **Bu bölümün ilk commit'i yalnız
YORUMDUR (ders 40 — önce kural, sonra kod); senaryo / mutant / G3 sayıları kod ve kanıt commit'lerinde eklenir.**

### C00u Temiz oda (bakım 17)
- **Girdi (tek kaynak; ana oturumun özet dosyası `scratchpad/kahin-eski17-kararlar.md`; KURAL KAYNAĞI yalnız KARAR satırlarıdır — soru metnindeki "program bugün (koşuldu)" / "BUGÜN" sözü beklenti kaynağı
  sayılmadı):**
  - S159 KARAR (13.11 10:40, AYNEN; 10:42 teyit): "S159 = A — tahsilat açık şüphelinin tamamını kapatıp borcu da aşarsa KABUL: açık şüpheli kalmadıysa S155 kuralı bağlamaz, fazlası avans olur."
    Soru örneği (AYNEN): "borç 1.000 → şüpheli 900 → bugün tahsilat 1.100 … KABUL — bakiye −100 (100 TL avans), açık şüpheli 0 (tam 1.000 tahsilatta bakiye 0, açık şüpheli 0; 300 tahsilatta bakiye
    700, açık şüpheli 600)".
  - Kart tahsilatı adımının seçeneği (ana oturum: "kural DEĞİL, senaryo dilinin eksiği"): DAYANAK S118 = B (11.11 06:14, AYNEN: "taksit tahsilatında 'Kalanı Aşan Tutar' / 'Kart Ödendi' sınırı,
    sorusu ve formda ÖNERİLEN tutar kartın KENDİ kalanından gelir") ve S154 = B (13.11 07:31, AYNEN: "'Fazlasını Avans Yaz' ile kapanan kartta 'Tahsil Edilen' karttan alınan paranın TAMAMIDIR (kart
    1.200 / 3; karttan 500, sonra karttan 800 avanslı → 'Tahsil Edilen 1.300 · Kalan 0', fazla 100, bakiye −100)"). İstenen: adım, tutar kartın KENDİ kalanını aşıyorsa yanıtı taşır — 'Fazlasını
    Avans Yaz' (kayıt yazılır; aşan kısım avans) ya da yanıt YOK / vazgeçildi (HİÇBİR kayıt yazılmaz — 'ret', sayılar değişmez); kalanı aşmayan tahsilatta seçenek anlamsız.
  - S162 = B (13.11 16:11, "önerilerin uygun"; soru metni girdi dosyasında AYNEN) — KAPSAM (ana oturum): "taksit kartı carinin borcunun TAMAMINI taşıyor (kart dışında açık borç yok) + FATURASIZ stok
    iadesi" alt durumunda kartın göstergeleri (kart toplamı, taksit sayısı / satırları, Tahsil Edilen, İade, hangi taksitin açık kaldığı) ve GECİKMİŞ; bakiyede SUSMA; başka açık borç VARKEN bugünkü
    beklenti AYNEN.
  - S163 = C (13.11 16:11; soru metni girdi dosyasında AYNEN) — KAPSAM (ana oturum): S153 = A'nın 'üretilirse düzelt'i KAPANDI; susma alanı "elle açılan ve tek bir borca denk gelmeyen kart (S120) +
    carinin o karttan ÖNCE tamamen kapanmış elle borçları var" alt durumunda açık KALEMLERİN dağılımı ve geçmiş bir güne göre gecikmiş; bakiye, kalemler toplamı ve BUGÜNKÜ toplam gecikmiş SUSMAZ.
  - S150 = A için BAŞ MİMAR YORUMU (13.11 16:11; "kullanıcıya gösterildi, değiştirebilir; 'karar' değil") — aşağıda Y17-9.
- **Birlikte okunan (kâhinin kendi belgesi):** bu dosyanın §13 C13.4 (3) / (4) / (6) / (7), §18 (S101 — Y6-4 / Y6-5, SK-14), §21 Y9-1 … Y9-7 (S120), §25 (S129 KARAR ve Y14-10 — 'kartın KENDİ
  kalanı' ↔ tek kuyruk), §26 (Y15-5 / Y15-7 / Y15-14 / Y15-16; S150 "alan yok"), §27 (bütünü — Y16-1 … Y16-11, SK-35); `model.py` (`kart_tahsilat`, `_s145_adim`, `kart_ac`, `kontrol` kart
  göstergeleri, `kontrol_v3` Vade Takip penceresi, `_alacak_govde250` bağlar / `kartfazla` / `pd` / `onceden`, `kos` iki dünya); `kos.mjs` YALNIZ `kart_tahsilat` ve Vade Takip eşlemesi (alan
  adı için; değiştirilmedi); d30 / d42 / d43 / d44 elle senaryoları; `docs/kanit/2026-11-13/kahineski16-arac/` araçları. Okunan dosyaların tam listesi (satır aralıklarıyla) ajan raporunda.
- **Okunmayan:** `server/**`, `client/**`, `bulut/**`, `packaging/**`, `tools/**` (yalnız `kanit.mjs` çalıştırılır), `docs/erp/C5-ACILIS-TASARIM.md`, `docs/erp/C5B-TYK-TASARIM.md`, `docs/devir/**`,
  `docs/2.5.0-IS-LISTESI*.md` (hiçbir sürümü), `test/bagimsiz/cari/YAPIM-ASAMASI.json`, iki kâhin klasörü dışındaki `test/**`, başka ajanların `docs/kanit/**` dosyaları (yalnız `kahineski16-arac/`
  araçları), git farkı / geçmiş içeriği. Program koşulmadı. CLAUDE.md "Açık iş"teki program durumu kural / beklenti kaynağı sayılmadı.

### Kâhinin BUGÜNKÜ (bakım 16, `kahin17-taban`) okuması — beş alanda (açıkça)
- **S159:** SUSUYOR — §27 Y16-5 SK-35: şüpheli kayıtlı caride adımdan önce A > 0, sonra A' = 0 ve B' < 0 → iki dünya (adım kabul ↔ adım yok), farklı çıkan denetimler (adımın durumu, bakiye …)
  yazılmıyor; neden "KULLANICIYA SORULMALI SK-35 (§27 Y16-5)". Kararın örneği d44 X12'dir (bakım 16 SK-35'in kendi örneği). A = A' = 0 (kayıtları önceden kapanmış cari) bakım 16'da zaten KABUL (d44 X13).
- **Adım seçeneği / S118 sınırı:** YOK — `kart_tahsilat {kayit, tutar, tarih}` her tutarda kabul; kartın açığını aşan kısım kendi tarihinde BAĞSIZ alacak (C13.4 (3) "kartfazla"). Kâhinde kartın
  'Kalanı Aşan Tutar' sınırı / sorusu yok (Y14-10 "tahsilat formunun sınırı (S118 = B) YOK — eklenmedi").
- **S154:** alan yok — `kartfazla` olan kartta `kart:<no>:odenen` S144 = C ile SUS (§26 Y15-14; neden metni §27 Y16-9 "S154 = B … kâhinin dilinde ayrı adım değil").
- **S162:** DEĞER veriyor — kâhinin tek kuyruğunda faturasız stok iadesi bağsız kapatıcıdır (C13.4 (4) ANINDA): kart taksitlerinin en eskisinden düşer (S2 sırası); kart toplamı kartın asıl tutarı;
  'Tahsil Edilen' / taksit 'Ödenen' iadeyi saymaz (S158 A), 'Kalan' = tutar − kuyrukta kapanan (iade dahil); gecikmiş kuyruk kalanından. Kararın örneği d42 T7'dir (S158 A'nın da örneği): kâhin
  'Tahsil Edilen 0 · Kalan 600', taksit 'Ödenen' 0 / 0 / 0, gecikmiş 300 (sorunun A'sı) yazıyor. Satış kartı yalnızken (carinin başka borcu yok) d42 T6: S140 A sırası (ilk açık taksitten).
- **S163:** DEĞER veriyor — S120 kartı (Y9-3) kartın günündeki AÇIK elle kalemleri eskiden yeniye içine alır; kapanmış elle borç ölçüye girmez (sorunun A'sı). Açık kalem dağılımı ve gecikmiş
  bu okumayla yazılıyor.
- **S150:** alan yok (§26 "S150: alan yok — Vade Takip denetimi kalem başına (`vadeTakip:hareket`, bugün + 6'ya kadar) ve görünüm toplamı; hazır aralık ve 'Gecikmiş Tahsilat' göstergesi yok").

### Yorumlar (ders 40 — kararlardan; kod yazılmadan ÖNCE; baş mimar kullanıcıya gösterir)
- **Y17-1 — S159: kural:** §27 Y16-1'in denetiminde adımdan SONRA carinin açık şüpheli tutarı A' = 0 ise kural BAĞLAMAZ — adım KABUL (bakiye eksiye inebilir; eksi bakiye carinin avansıdır).
  Kararın gerekçesi ("açık şüpheli kalmadıysa S155 kuralı bağlamaz") adım türünü ayırmıyor ve S155 "türü fark etmez" diyor → tahsilat dışındaki alacak satırı (alınan evrak, elle Alacak, faturasız
  stok iadesi, iade faturası, Taksit Tahsilatı) açık şüpheliyi sıfırlayıp bakiyeyi eksiye indirirse de KABUL (tek okuma). Böylece SK-35 (bakım 16) KALKAR; Y16-4 (adımdan önce kural zaten bozuk,
  A' > 0) AYNEN SUS. Kararın örneği AYNEN = d44 X12: borç 1.000 (16.04) → 16.05 Şüpheli 900 → bugün (15.06) tahsilat 1.100: 900 şüpheliden düşer (Y16-2 (a) — kayıt tarihinden sonraki tahsilat),
  200 normal cariye; A' = 0, B' = −100 → KABUL, bakiye −100, Kasa'da 1.100, açık şüpheli 0 (görünen kalem yok, gecikmiş 0). **Komşular (kararın kendi sayıları):** tam 1.000 → A' = 0, B' = 0 → kabul
  (S155'in eşitliği de kabul) — bakiye 0, açık şüpheli 0; 300 → A' = 600 > 0, B' = 700 ≥ 600 → kabul — bakiye 700, açık şüpheli 600 (görünen 100). **Şüpheliden ÖNCEYE tarihli aşan tahsilat** (aynı
  örnek, tahsilat 06.05 tarihli 1.100): önceye tarihli satır şüpheliden DÜŞMEZ (Y16-2 (b); S145'in soru metni) → A' = 900 > 0 kalır, B' = −100 < 900 → S155 RET (bakiye 1.000, açık şüpheli 900) —
  açık şüpheli KALDIĞI için S159'un "kalmadıysa"sı uygulanmaz; S155 A'nın harfi tek sonuç veriyor → DEĞER (soru değil). Etiket KULLANICI (S159 A).
- **Y17-2 — adım seçeneği: alan, değerleri, sınır (S118 = B):** `kart_tahsilat {kayit, tutar, tarih, fazlasiniAvansYaz}` — YENİ alan **`fazlasiniAvansYaz`**: `true` = kullanıcı 'Kalanı Aşan
  Tutar' sorusuna **'Fazlasını Avans Yaz'** dedi; alan YOK ya da `false` = yanıt yok / vazgeçildi. **Sınır K (kartın KENDİ kalanı):** K = kart tutarı − karta DOĞRUDAN bağlı tahsilatların toplamı
  (kartın önceki kabul edilmiş Taksit Tahsilatları + Tablodan Aktar'ın karta taşıdığı tahsilatlar / önceden ödenen parça). Dayanak: S129 KARAR — göstergeler tek kuyruktan, "tahsilat formunun
  sınırı / sorusu / önerilen tutarı S118 = B'deki gibi kartın KENDİ kalanından kalır" (iki hesap ayrı); S129'un örneği: kart 900, karta BAĞLANMADAN 500 tahsilat → göstergeler 'Kalan 400' ama sınır
  kartın kendi kalanı 900 — kart seçilmeden alınan tahsilatın tek kuyruktaki payı (S50) K'yı DÜŞÜRMEZ. **Kural (2.5.0):** (a) tutar ≤ K → soru yok; seçenek etkisiz (verilse de sonuç aynı); adım §13
  C13.4 (3) ile kabul. (b) tutar > K ve `fazlasiniAvansYaz: true` → adım KABUL: kayıt yazılır (Kasa + tutar), kartın açık taksitleri vadesi ilk gelenden kapanır, AŞAN kısım avans — kâhinin tek
  kuyruğunda "bağ fazlası kendi tarihinde BAĞSIZ alacak" (C13.4 (3) / (4) ANINDA, (1) A): carinin o gün açık başka borcu varsa onu kapatır, yoksa carinin avansı olarak kalır (kâhinin önceki kuralı
  AYNEN; 'avans' ↔ 'bağsız alacak' kâhinin dilinde aynı şeydir). (c) tutar > K ve seçenek yok → adım **RET**: hiçbir satır yazılmaz — Kasa, bakiye, kart, kuyruk değişmez; `adim:<id>:durum` = `"ret"`
  (ileti / kod YAZILMAZ — karar metni vermedi). Elle senaryo dosyasında ret: `"elleBeklenen": {"adim:<id>:durum": "ret", …}` + değişmeyen bakiye / kart değerleri. Etiket KULLANICI (S118 B).
  **K'nın SINIRI (iki okuma — kâhinin belgelerinden TEK biçimde çıkmıyor):** "kartın KENDİ kalanı" (i) yukarıdaki K mı, (ii) K' = K − kartın avansla ödenmiş sayılan kısmı (S101 A: "satışın avansla
  kapanmış kısmı kartın ödenmiş kısmı" — §18 R1 `onceden`) − kartın taksitlerini kapatan para DIŞI kapatıcı payı (faturasız stok iadesi, iade faturasının artanı, Değersiz — S151 / S158: 'Tahsil
  Edilen'e sayılmaz ama 'Kalan'ı düşürür) mı? Kâhin adım anındaki K ve K''yü hesaplar: tutar ≤ K' → (a); tutar > K → (b) / (c); **K' < tutar ≤ K** → seçenek `true` ise iki okumada da KABUL (soru yoksa
  kabul; soru varsa 'Fazlasını Avans Yaz') → DEĞER; seçenek YOKSA okuma (i) KABUL ↔ okuma (ii) RET — BAKİYE OKUMALAR ARASINDA FARKLI → **SUS** (iki dünya: adım kabul ↔ adım yok; bakım 7 SK-18
  düzeni), neden "KULLANICIYA SORULMALI SK-36 (§28 Y17-2)".
- **Y17-3 — S154 = B: değer alanı ve S144 (c) ile sınırı:** 'Fazlasını Avans Yaz' ile kapanan kart = kartın en az bir Taksit Tahsilatı Y17-2 (b) ile kabul edildi (tutar > K, iki okumada da soru
  soruldu) VE o adımlarda K' = K (kartta avansla ödenmiş kısım / para dışı pay yok) VE kontrol anında kartın avansla ödenmiş sayılan kısmı 0. O kartta: **'Tahsil Edilen'** (`kart:<no>:odenen`) =
  karttan alınan paranın TAMAMI (kartın kabul edilmiş Taksit Tahsilatları + Tablodan Aktar'ın taşıdığı tahsilatlar / parça); **'Kalan'** (`kart:<no>:kalan`) = 0 (bağlar kartın bütün taksitlerini
  kapatır — tek kuyruk, değişmez); taksit **'Ödenen'** = taksitin tek kuyruktaki payı (S129 — taksit tutarları; değişmez); bakiye, fazlanın gittiği yer C13.4 (3) / (4) aynen. Kararın örneği AYNEN:
  kart 1.200 / 3 (400 × 3), karttan 500 (K 1.200 ≥ 500 — soru yok), sonra karttan 800 'Fazlasını Avans Yaz' (K 700 < 800) → 'Tahsil Edilen 1.300 · Kalan 0', taksit 'Ödenen' 400 / 400 / 400, fazla
  100, bakiye −100. **S144 (c)'nin ÖBÜR alt durumları (SUS AYNEN — S144 = C):** kartın kuyruk fazlası ('kartfazla') bu yoldan DOĞMADIYSA — kartın kendi tahsilatı K'yı aşmadığı hâlde avansla ödenmiş
  sayılan kısım (S101) yüzünden kuyrukta artıyorsa (d30 KQ1 / KQ3) ya da fazla Y17-2'nin K' < tutar ≤ K seçenekli adımından doğduysa — `kart:<no>:odenen` YAZILMAZ; neden metni "BİLİNEN SINIR
  (kullanıcı kararı S144 = C) S144 (§28 Y17-3 — S154 = B yalnız kartın kendi kalanını aşan 'Fazlasını Avans Yaz' adımıyla kapanan kartta)". Etiket KULLANICI (S154 B).
- **Y17-4 — kartın kendi kalanını aşan tahsilat adımı taşıyan MEVCUT senaryolar (tarama: bütün elle senaryolar + rastgele s1 / ux18 tohum 1–10 × 120 işlem, iki dünya örnekleri dahil; 71 kart
  tahsilatı adımının 5'i K' < tutar ya da K < tutar):** her birinin yazılış amacı ve yeni hâli —
  (1) **d43 U1** (`u1k`: kart 1.000, K 1.000, tutar 1.100 — K'yı AŞIYOR): amacı S144 (c)'nin kendi örneği (kartın kendi tahsilatının fazlası, kabul edilip fazlası avans; eski beklentiler bakiye
  −100, Kalan 0, taksit 500 / 500 — KABUL varsayıyor). Programda kartın kendi kalanını aşan tahsilatın kabul edildiği tek yol 'Fazlasını Avans Yaz'dır (S118 B) → **seçenekli** (`fazlasiniAvansYaz:
  true`); beklentiler AYNI + `kart:KU1:odenen` `elleYok`'tan **110000**'e (S154 B — karttan alınan paranın tamamı), `belirsiz`'deki S144 kaydı KU1 için kalkar.
  (2) **d43 U2** (`u2k`: kart 400, K 400, tutar 600 — AŞIYOR): amacı S141 (kart fazlası + fatura belge açığı); kabul varsayıyor (takvimde F 400) → **seçenekli**; beklentiler AYNI +
  `kart:KU2:odenen` `elleYok`'tan **60000**'e (S154 B); S141'in susması (U2F belge açığı, açık toplamı) AYNEN; KU2'nin S144 kaydı kalkar.
  (3) **d30 Q1** (`q1k`: avansla 'Bitti' satış kartı 600, K 600, K' 0, tutar 300 — sınır bölgesi): amacı S101 A'nın kendi örneği ("kartın tahsilatı avansa eklenir" — kabul) → **seçenekli** (iki
  okumada da kabul); beklentiler AYNI; `kart:KQ1:odenen` S144 = C ile SUS AYNEN (fazla S101'den — Y17-3).
  (4) **d30 Q3** (`q3k`: K 600, K' 200, tutar 500 — sınır bölgesi): amacı "kart tahsilatı açık kısmı aşıyor" (S101 — fazla avansa) → **seçenekli**; beklentiler AYNI; KQ3 `odenen` SUS AYNEN.
  (5) **d30 Q5** (`q5k`: K 600, K' 0, tutar 300 — sınır bölgesi): amacı SK-14 (cari tanımsız — S101 × (2) A) — adımın kabulü S101 A'nın "kartın tahsilatı avansa eklenir"i → **seçenekli**;
  beklentiler AYNI (cari tanımsız; bakiye ve kart tutarı yazılır).
  Rastgele s1 / ux18: K' < tutar olan kart tahsilatı YOK → üretici DEĞİŞMEZ (aynı dizi). Öbür 66 kart tahsilatı tutar ≤ K' (seçenek gerekmez, değişmez). Amacı karar metinlerinden tek biçimde
  çıkmayan senaryo YOK (hepsi kabul varsayıyordu ve kabulün tek yolu seçenek).
- **Y17-5 — S162 = B: susma alanı (koşullar tek tek — kontrol anında, her etkin taksit kartı için):** (1) kartın taksitlerinden en az birinin bir kısmını **faturasız stok iadesi** kapattı (tek
  kuyrukta kalemin para dışı payı "stok" > 0); (2) kontrol anında carinin tek kuyruğunda kart taksitleri DIŞINDA açık (kalanı > 0) borç yönlü kalem YOK — taksitsiz satış faturası, taksitli satış
  faturasının taksiti, elle Borç / borçlu Açılış, stok veresiye satışı, karşılıksız borç kalemi (ölçü kontrol anı: kararın karşılaştırma örneğinde borç SONRADAN yazılınca iade ilk taksitten düşüyor
  — durum anı belirler); (3) kartın türü Taksitler'den Mevcut Borç / Yeni Borç kartı ya da Tablodan Aktar kartı (satış kartı OLMAYAN — S158'in örneği) → **BİLİNEN SINIR (kullanıcı kararı S162 = B)**.
  Stoktan taksitli satışla açılan kart (satış kartı) aynı yapıda (carinin tek borcu kendi satışı, sonra faturasız iade — d42 T6) → S140 A ("kart iadeyle küçülünce KENDİ satışını taşır … [0, 200]" —
  örneği başka borçlu caride) ile S162'nin B'si ("başka borç yokken kart sondan küçülür") bu alt durumda iki okuma → **SUS** + KULLANICIYA SORULMALI **SK-37**. **SUS anahtarlar:** `kart:<no>:toplam`
  (kart toplamı — sondan küçülme ↔ asıl tutar), `kart:<no>:taksit<i>:odenen` (taksit satırları — hangi taksitin kaldığı), carinin `cari:<ad>:gecikmis` (kararın örneğinde 600 ↔ 300). **DEĞER
  (SUSMAZ):** bakiye (kararın sözü); `kart:<no>:kalan` ve `kart:<no>:odenen` — iki okumada AYNI ve S158 A KARARI'nın kendi örneği bu alt durumdadır ("Borç 900 → kart 900 → iade 300: 'Tahsil
  Edilen 0', 'Kalan 600'"; S162'nin 'BUGÜN'ü de 'Tahsil Edilen 0 · Kalan 600'); Kasa, görünüm toplamı (Σ = bakiye), sayaç (açık taksit adedi iki okumada aynı). KAPSAM'dan SAPMA (açıkça; BAŞ
  MİMAR'A — değerlendir): KAPSAM 'Tahsil Edilen'i susma listesine koyuyor; kâhin onu yazmaya DEVAM eder (gerekçe yukarıda — kararlı ve iki okumada aynı). 'İade' göstergesi ve taksit sayısı
  kâhinin dilinde anahtar değil. Neden metni: "kart <no> göstergeleri kısmen tanımsız (2.5.0 §28): … BİLİNEN SINIR (kullanıcı kararı S162 = B) S162 (§28 Y17-5)" ve "cari <ad> gecikmiş tutarı
  tanımsız (2.5.0 §28 Y17-5) … S162". (2) sağlanmıyorsa (başka açık borç VAR) bugünkü beklenti AYNEN (S151 / S158 — kararın karşılaştırma örneği: kart 900, iade ilk taksitten, 'Tahsil Edilen 0 · Kalan
  600', gecikmiş 300).
- **Y17-6 — S163 = C: susma alanı (koşullar tek tek):** (1) carinin kartı S120 alanında (Y9-3: Taksitler'den ELLE açılan Mevcut Borç kartı, açıldığı anda açık borç kart tutarından fazla, tutarı karta
  eşit TEK elle borç yok — kart açık elle kalemleri eskiden yeniye içine aldı; Y9-2 'kendi' kartı, O = T kartı (S122 Y10-3 / S126 / S128), satış kartı, Tablodan Aktar kartı DIŞINDA — kararın "(S120)"si);
  (2) kartın açıldığı ADIMDA carinin, kartın gününden önce doğmuş ve o anda TAMAMEN kapanmış (tek kuyruk kalanı 0 ve bir kartın içine alınmamış) en az bir elle borcu (elle Borç Yaz ya da borçlu
  Açılış) var. Kâhin (2)'yi kart adımı anında, o ana kadar girilmiş kayıtlarla ölçer — kart adımından SONRA girilen geriye tarihli bir kayıtla kapanan eski borç ölçüye girmez (kâhinin sınırı;
  DENENMEYEN). **Ayırt edebildiği:** iki koşul kâhinin kendi verisinden (S120 izi `s120`, kart adımındaki kuyruk) kesin okunuyor; programın "önceden ödenmiş" ölçüsünün NASIL hesaplandığı (yalnız soru
  metni) kâhinde YOK → değer üretilmez, yalnız alan ayrılır. **SUS anahtarlar (o carinin):** açık KALEMLERİN dağılımı — `fatura:<ad>:acik`, `hareket:<id>:kalan`, `takvim | vadeTakip |
  projeksiyon:hareket:<id>` ve `:fatura:<ad>`, kartlarının `odenen` / `kalan` / `taksit<i>:odenen` (kararın örneği 'fatura 247 + taksit 413' ↔ 'fatura 162 + taksit 498' — taksitin açığı da kayıyor);
  `cari:<ad>:gecikmis` YALNIZ carinin açık kalemlerinden en az birinin vadesi bugün ya da ileride ise (dağılım kayınca bugünkü gecikmiş de kayabilir — kararın 'geçmiş bir günde 702 ↔ 787'si o günde
  vadesi gelmemiş kalem bulunduğu için; bütün açık kalemlerin vadesi geçmişse gecikmiş = Σ açık = bakiye − R iki okumada AYNI — kararın 'bugünkü 1.670 = 1.670'si). **DEĞER (SUSMAZ):** bakiye, kalemler
  toplamı (`cariToplam`, `acikToplam`, `acikEsitBakiye` — yazılıyorsa), Kasa; bütün açık kalemlerin vadesi geçmişken gecikmiş. Neden: "cari <ad> açık kalem dağılımı tanımsız (2.5.0 §28 Y17-6): S120
  kartı <no> açılırken carinin kapanmış elle borcu (<adlar>) vardı — BİLİNEN SINIR (kullanıcı kararı S163 = C) S163". S153 = A'nın 'üretilirse düzelt'i kâhinde kural değildi (eklenmemişti) —
  kapanması kâhinde bir değeri değiştirmez.
- **Y17-7 — S162 / S163'te bakiyede / toplamlarda neden SUSMUYOR:** iki sorunun iki okuması da yalnız AYNI borcun kalemler (taksitler) arasındaki dağılımını değiştirir; hiçbir satır yazılmaz /
  silinmez (S162: iade ikisinde de karttan düşer; S163: kartın ölçüsü bakiyeye girmez) → bakiye, Σ kalem, Kasa, mizan / yevmiye iki okumada aynı (girdi dosyası da öyle diyor: S162 bakiye 600 =
  600; S163 bakiye 1.670 = 1.670, kalemler toplamı = bakiye).
- **Y17-8 — DEĞİŞMEYEN:** kart tahsilatı tutar ≤ K' (bütün eski senaryoların 66 kart tahsilatı); S155'in RET / Y16-4 alanı; S158 / S151 / S140 değerleri (Y17-5 alanı dışında); S144 (c)'nin öbür
  alt durumları; S141 / S143 / S149 / S156 / S157 susmaları; `--kural 2.4.9` ve öncesi (seçenek alanı okunmaz).
- **Y17-9 — S150 = A — BAŞ MİMAR YORUMU (karar değil; kullanıcıya gösterildi, değiştirebilir) — AYNEN:** "'her aralıkta aynı sayı' ALTI hazır aralığın hepsini kapsar (Gecikmiş, Bugün, 7 Gün, 30
  Gün, 90 Gün, Tüm Açık); gösterge ile satırlar ayrışmasın diye (toplam = satırlar) 'Bugün' ve '7 Gün' aralıklarında da durumu Gecikmiş olan HER kalem satır olarak listelenir; ELLE girilen tarih
  aralığı bu yorumun DIŞINDADIR (değişmez). Yorumun kapattığı durum: vadesi geçmiş, sözü aralıktan SONRA olan borç (ör. vade 10 gün önce, söz 15 gün sonra) 'Bugün' ve '7 Gün' aralıklarında da
  'Gecikmiş Tahsilat' göstergesine ve satırlara girer. … S149 = C alanında susman AYNEN sürer." **Kâhinde alanı: YOK** — kâhinin dilinde Vade Takip'in hazır aralığı ve 'Gecikmiş Tahsilat'
  göstergesi yok; Vade Takip denetimi kalem başına (`vadeTakip:hareket:<id>` — kalem tarihi, Beklenen varsa o, bugün + 6'ya kadar KESİN; sonrası yazılmaz) ve görünüm toplamı; koşucu Vade Takip'i
  YALNIZ 'Tüm Açık' (`preset=open`) ile okuyor (`kos.mjs` eşlemesi — alan adı için okundu, değiştirilmedi). Yorumun kapattığı durumdaki kalem (söz bugün + 15) kâhinde bugün + 6 penceresinin
  dışında → hiçbir anahtar yazılmıyor (ne "var" ne "yok") — yorumla ÇELİŞEN beklenti YOK; beklenti DEĞİŞMEZ. Gecikmiş sayılma kuralı (C13.5 / S52 / S67 / S69; S149 = C susması) AYNEN. Ana
  oturuma: hazır aralık denetimi istenirse koşucuya `preset` okuması + kâhine aralık anahtarı (ayrı bakım).

### Beş alanın alt durumları (açıkça)
| Alt durum | Bakım 16 | Bakım 17 |
|---|---|---|
| S159: adım açık şüpheliyi sıfırlıyor (A > 0 → A' = 0), bakiye eksiye (kararın örneği; d44 X12) | SUS (SK-35) | **DEĞER = KABUL** (Y17-1) |
| S159: tam 1.000 / 300 (kararın komşuları) | DEĞER (kabul) | DEĞER (kabul — aynen) |
| S159: şüpheliden ÖNCEYE tarihli aşan tahsilat (A' > 0) | DEĞER (RET) | DEĞER (RET — aynen; S155) |
| Kart tahsilatı tutar ≤ K' | kabul | kabul (aynen; seçenek etkisiz) |
| Kart tahsilatı tutar > K, seçenekli | kabul (fazlası bağsız) | **KABUL** (Y17-2 (b)) |
| Kart tahsilatı tutar > K, seçeneksiz | kabul | **RET** (Y17-2 (c)) |
| Kart tahsilatı K' < tutar ≤ K, seçenekli | kabul | kabul (iki okumada) |
| Kart tahsilatı K' < tutar ≤ K, seçeneksiz | kabul | **SUS** — KULLANICIYA SORULMALI SK-36 |
| S154: 'Fazlasını Avans Yaz' ile kapanan kartın 'Tahsil Edilen'i | alan yok (S144 SUS) | **DEĞER = B** (Y17-3) |
| S144 (c): kart fazlası S101'den / sınır bölgesinden | SUS | SUS (aynen; metin) |
| S162: kart carinin bütün açık borcunu taşıyor + faturasız stok iadesi (satış kartı olmayan) | DEĞER (A gibi) | **SUS** toplam / taksit Ödenen / gecikmiş — BİLİNEN SINIR; Kalan / Tahsil Edilen / bakiye DEĞER |
| S162 × satış kartı (carinin tek borcu kendi satışı) | DEĞER (S140 A) | **SUS** — KULLANICIYA SORULMALI SK-37 |
| S162: başka açık borç var (karşılaştırma örneği) | DEĞER | DEĞER (aynen) |
| S163: S120 kartı + kart adımında kapanmış elle borç | DEĞER (A) | **SUS** açık kalem dağılımı (+ vadesi gelmemiş kalem varsa gecikmiş) — BİLİNEN SINIR |
| S163: kapanmış eski borç yok / kart S120 değil | DEĞER | DEĞER (aynen) |
| S150 (hazır aralık) | alan yok | alan yok (BAŞ MİMAR YORUMU — beklenti değişmez) |

### KULLANICIYA SORULMALI (bakım 17; kâhin bu durumlarda SUSAR — ders 43, SORU DÜZENİ)
- **SK-36 (S118 = B'nin sınırı — 'kartın KENDİ kalanı'na avansla ödenmiş kısım / para dışı iade payı girer mi; BAKİYE OKUMALAR ARASINDA FARKLI):** (a) avansla 'Bitti' kart: 01.05 tahsilat 1.000
  (avans) → 05.05 stoktan taksitli satış 600 (2 × 300; kart avansla kapanmış — S101 A) → 10.05 karta Taksit Tahsilatı 300, 'Kalanı Aşan Tutar' sorusu yanıtsız. **A (kendi kalanı = kart tutarı −
  kartın kendi tahsilatları = 600 — soru çıkmaz):** KABUL — 300 avansa (S101 A), bakiye −700. **B (kendi kalanı avansla ödenmiş kısmı da düşer = 0 — soru çıkar, yanıt yok):** RET — bakiye −400.
  (b) para dışı pay: 01.03 Borç 900 + Borç Z 500 (vade 30.06) → 15.03 kart 900 (3 × 300) → 10.04 faturasız stok iadesi 300 (kartın 1. taksitinden) → 10.05 karta 700, yanıtsız. **A (kendi kalanı
  900):** KABUL — bakiye 400 / **B (kendi kalanı iade düşülmüş 600):** RET — bakiye 1.100. **C (ikisi için):** uç durum böyle kalsın (BİLİNEN SINIR — kâhin susar). Seçenekli ('Fazlasını Avans Yaz')
  adımda iki okuma da KABUL — soru yalnız yanıtsız adım içindir.
- **SK-37 (S162 = B × S140 A — satış kartı carinin TEK borcunu taşıyorken faturasız iade; bakiye her seçenekte aynı):** 01.05 stoktan taksitli satış 1.000 (2 × 500: 01.06, 01.07) → 10.05 karta Taksit
  Tahsilatı 300 → 10.06 faturasız stok iadesi 400; bugün 15.06; bakiye 300, 'Tahsil Edilen 300 · Kalan 300' iki okumada aynı. **A (S140 A'nın sırası — iade ilk açık taksitten, kart 1.000 kalır):**
  1. taksit kapanır (Ödenen 300), 2. taksit 300 açık; gecikmiş 0 / **B (S162 = B'nin kuralı satış kartında da — "başka borç yokken kart sondan küçülür"):** kart 600 (2. taksit 100'e iner), 1.
  taksitin 200'ü açık; gecikmiş 200 — BİLİNEN SINIR, kâhin susar / **C:** uç durum böyle kalsın (BİLİNEN SINIR). (Satış kartında başka borç VARKEN S140 A aynen — soru değil.)

### Kurallar (kod commit'i; yorumların `model.py`'deki karşılığı)
- **C28.1 S159 `_s145_adim` (Y17-1):** bakım 16'nın SK-35 dalı (adımdan önce A > 0, sonra A' = 0, B' < 0 → `sus_s145`) YERİNE KABUL: `_iz15` "s159", adımın durum etiketi `("KULLANICI", "§28 Y17-1 S159
  A …")`. Mutant 303 (S159 B): aynı dalda RET. Y16-4 (A > 0 iken önceden bozuk) dalı AYNEN; `sus_s145` artık yalnız Y16-4 içindir.
- **C28.2 `kart_tahsilat` seçeneği (Y17-2) — yalnız `k250`:** K = `toplam` − Σ `tasinan` − `parca`; adım anındaki tek kuyruktan (`tyk250`) kartın para dışı payı (`pd` "kart:<no>#i" toplamı) ve avansla
  ödenmiş kısmı (`onceden[no]`) → K' = K − `onceden` − `pd`. `fazlasiniAvansYaz is True` → seçenek. Tutar > K: seçeneksiz → `("ret", "KULLANICI", "§28 Y17-2 S118 B …")` (hiçbir satır yazılmadan; `_iz15`
  "s118ret"); seçenekli → kabul, kart `_s154` (K' = K) ya da `_s154x` (K' < K) izi, durum etiketi KULLANICI. K' < tutar ≤ K: seçenekli → kabul + `_s154x`; seçeneksiz → kabul ve `sus_s118`'e
  (adım, kart, cari, K, K', tutar), `_iz15` "s118sus". ≤ 2.4.9: değişmedi (alan okunmaz). Mutantlar 304 (seçenek yok — eski davranış), 305 (her zaman ret), 307 (K = tutar − tek kuyruk ödeneni).
- **C28.3 `kos` iki dünya (Y17-2 SK-36):** `sus_s118` doluysa bakım 16'nın `sus_s145` düzeni: SUS adımı ve ona başvuran sonraki adımlar (evrak / hareket / kayıt / şüpheli / fatura / ödeme alanı) çıkarılmış
  senaryo ayrıca koşulur; iki dünyada farklı çıkan (ya da yalnız birinde olan) her denetim silinir; `belirsiz`: "adım <id>: cari <ad> kart <no> Taksit Tahsilatı <tutar> kartın kendi kalanının iki
  okumasının arasında (…) — … KULLANICIYA SORULMALI SK-36 (§28 Y17-2)".
- **C28.4 S154 `kontrol` kart göstergeleri (Y17-3):** kart `kartfazla`'daysa ve `_s154` var, `_s154x` yok, kontrol anında `onceden[no]` = 0 → `kart:<no>:odenen` = Σ `tasinan` + `parca` (karttan alınan
  paranın tamamı; etiket KULLANICI; `_iz15` "s154"); mutant 306: `min(…, toplam)`. Öbür `kartfazla` kartları S144 = C SUS AYNEN, neden metni "BİLİNEN SINIR (kullanıcı kararı S144 = C) S144 (§28 Y17-3 —
  S154 = B yalnız kartın kendi kalanını aşan 'Fazlasını Avans Yaz' adımıyla kapanan kartta)". Kalan / taksit Ödenen değişmedi.
- **C28.5 S163 izi `kart_ac` (Y17-6):** `k250`, Mevcut Borç kartı, satış kartı değil: kart dict'i kurulmadan ÖNCE carinin tek kuyruğunda kalanı 0 ve hiçbir kartın `tuketilen`'inde olmayan elle
  borçları (elle Borç / borçlu Açılış, tutar > 0) → `kartlar[no]["_s163"]` (yalnız iz — kartın hesabını değiştirmez).
- **C28.6 `_sus17` (Y17-5 / Y17-6) — `kontrol`'ün sonunda (`k250`):** S162: etkin kartın taksitlerinde `pd` "stok" > 0 ve carinin kuyruğunda kart taksitleri dışında (`tur` "n", kalanı > 0, `kart`
  boş ya da "fatura:" — taksitli fatura başka borçtur) kalem yok → `kart:<no>:toplam`, `kart:<no>:taksit<i>:odenen`, `cari:<ad>:gecikmis` silinir; neden satış kartı DEĞİLSE "BİLİNEN SINIR (kullanıcı
  kararı S162 = B) S162 (§28 Y17-5)" (`_iz15` "s162"), satış kartıysa "KULLANICIYA SORULMALI SK-37 (§28 Y17-5 — S140 A ↔ S162 B …)" ("sk37"). S163: kartın `_s163`'ü var ve kart tek kuyruğun `s120`
  listesinde → o carinin satış faturalarının `acik`'ı, borç yönlü elle kayıtlarının `kalan`'ı, `takvim | vadeTakip | projeksiyon:hareket | fatura` kalemleri, carinin bütün kartlarının `odenen` /
  `kalan` / `taksit<i>:odenen`'i ve — açık (kalanı > 0) borç yönlü bir kalemin vadesi ≥ bugün ise — `gecikmis` silinir; neden "cari <ad> açık kalem dağılımı tanımsız (2.5.0 §28 Y17-6): S120 kartı <no>
  açılırken carinin kapanmış elle borcu (<adlar>) vardı — BİLİNEN SINIR (kullanıcı kararı S163 = C) S163" (`_iz15` "s163"). `belirsiz` kaydı yalnız gerçekten silinen denetim varsa yazılır.
- `--kural 2.4.9` / 2.4.6 / 2.4.5 / `--legacy`: hiçbir yol değişmedi (C28.1 / C28.2 / C28.5 / C28.6 yalnız `k250`; C28.4 `k250` dalında).

### C8u Nasıl bozulur? (bakım 17 — kod commit'inde, senaryolarla birlikte yazıldı)
| # | Bozulma | Senaryo |
|---|---|---|
| Z196 | Açık şüpheliyi sıfırlayıp eksiye inen adım reddedilir / susulur (S159 B) | d44 X12 (kararın örneği), d45 Z5 (çek) — mutant 303 |
| Z197 | Şüpheliden önceye tarihli aşan tahsilat S159 ile kabul edilir (açık şüpheli KALDI) | d45 Z4 (RET) |
| Z198 | Kartın kendi kalanını aşan seçeneksiz Taksit Tahsilatı kabul edilir (fazlası bağsız — eski davranış) | d45 A2, eski d43 U1 / U2 (mutant 304) |
| Z199 | 'Fazlasını Avans Yaz' seçenekli adım reddedilir | d45 A1, d43 U1 / U2, d30 Q1 / Q3 (mutant 305) |
| Z200 | Seçenek kalanı aşmayan tahsilatı değiştirir / tam kalan (= K) ret | d45 A3 / A4 |
| Z201 | 'Tahsil Edilen' kart tutarını aşmaz (S154 A) | d45 A1, d43 U1 / U2 (mutant 306) |
| Z202 | Sınır tek kuyruk Kalan'ı — kart seçilmeden alınan tahsilatın payı kartın kendi kalanını düşürür (S118 A) | d45 A5 (mutant 307), d30 Q4 |
| Z203 | Sınır bölgesinde (para dışı / avansla ödenmiş pay) seçeneksiz adımda değer uydurulur | d45 A6 (SK-36 SUS), A6B (seçenekli — değer), eski d30 Q1 / Q3 / Q5 |
| Z204 | S162 alanında kart toplamı / taksit Ödenen / gecikmiş yazılır; Kalan / Tahsil Edilen / bakiye susulur | d45 B1, d42 T7, d44 Y4; satış kartı d42 T6 (SK-37) |
| Z205 | Başka açık borç varken (karşılaştırma örneği) susulur ya da değer değişir | d45 B2 |
| Z206 | S163 alanında açık kalem dağılımı yazılır; bakiye susulur; bütün kalemler gecikmişken gecikmiş susulur | d45 C1 / C3; komşu C2 (değerle) |

### Senaryolar (bakım 17; elle tablolar — kâhin koşulmadan karar metinlerinden ve §28'den; betik `docs/kanit/2026-11-13/kahineski17-arac/senaryolar17.py`)
- **`d45-c5-s159-s154-s162-s163`** (bugün 15.06.2026; 91 elle değer + 20 `elleYok` + 4 `elleBelirsiz` = 115 elle denetim): **S159 komşuları** (kararın örneği d44 X12'de; borç 1.000 (16.04) → şüpheli 900
  (16.05)): Z2 bugün tahsilat 1.000 → KABUL, bakiye 0, görünüm 0, gecikmiş 0 · Z3 300 → KABUL, bakiye 700, görünüm 100, gecikmiş 100 · Z4 06.05 tarihli (şüpheliden önce) 1.100 → RET (açık şüpheli
  kaldı — S155), bakiye 1.000, görünüm 100 · Z5 bugün tarihli alınan çek 1.100 → KABUL (türü fark etmez), bakiye −100. **S154 / seçenek** (borç 1.200 → kart 1.200 / 3): A1 S154'ün örneği AYNEN
  (karttan 500, sonra 800 'Fazlasını Avans Yaz' → 'Tahsil Edilen 1.300 · Kalan 0', taksit 400 / 400 / 400, bakiye −100, gecikmiş 0) · A2 aynı adım seçeneksiz → RET (Tahsil Edilen 500 · Kalan 700,
  taksit 400 / 100 / 0, bakiye 700, gecikmiş 700) · A3 kalanı aşmayan 500 seçenekli → A2'nin ilk adımıyla aynı · A4 500 + tam kalan 700 seçeneksiz → KABUL (1.200 · 0, bakiye 0) · A5 S129'un örneği +
  sınır kartın kendi kalanı (kart 900 / 3, karta bağlanmadan 500, karttan 600 seçeneksiz → KABUL; Tahsil Edilen 900 · Kalan 0, taksit 300 / 300 / 300, bakiye −200) · A6 SK-36 (b) (Borç 900 + Borç Z 500
  vade 30.06 → kart 900 → stok iadesi 300 → karttan 700 seçeneksiz: K 900, K' 600 → SUS; adımın durumu ve bakiye `elleYok`) · A6B aynı seçenekli → KABUL (bakiye 400; Tahsil Edilen 700 (iadenin payı
  sayılmaz — S158), Kalan 0, taksit 300 / 300 / 100, Z Kalan 400, gecikmiş 0). **S162** (Borç 900 → kart 900 = 3 × 300, vadeler 06.05 / 06.06 / 06.07 → 10.06 stok iadesi 300): B1 kararın örneği —
  kart toplamı, taksit Ödenen'leri, gecikmiş `elleYok` (SUS), Kalan 600, Tahsil Edilen 0, bakiye 600 · B2 karşılaştırma örneği AYNEN (sonradan Borç 500, vade 30.06): kart 900, Kalan 600, Tahsil
  Edilen 0, taksit 0 / 0 / 0, gecikmiş 300, bakiye 1.100. **S163** (E0 300 (01.01) → tahsilat 300 → E1 500 + F 600 + E2 400 → elle kart 700 (S120: E1 + E2'nin 200'ü)): C1 (taksitler ileride) —
  F açığı, E1 / E2 Kalan, kart göstergeleri, F takvim kalemi, gecikmiş `elleYok`; bakiye 1.500 · C2 komşu (E0 yok): F açığı 600, E1 Kalan 500, E2 Kalan 400, kart 700 / 0 / 700, takvimde F 600,
  gecikmiş 800 (F 600 + E2'nin açık 200'ü), bakiye 1.500 · C3 (C1, taksitler 01.03 / 01.04 — bütün açık kalemler gecikmiş): dağılım `elleYok`, gecikmiş 1.500 = bakiye (yazılır).
- **`d44` (karar gereği güncellendi):** X12 (S159'un kendi örneği; bakım 16 SK-35 SUS) → `adim:x12t:durum` "ok", bakiye −100, gecikmiş 0; SK-35 `elleBelirsiz`'i kalktı. Y4 (kart + Taksit Tahsilatı
  300 + stok iadesi 300, başka borç yok — S162 alanı): taksit Ödenen'leri `elleBeklenen`'den `elleYok`'a (+ kart toplamı, gecikmiş); 'Tahsil Edilen 300', 'Kalan 300', bakiye AYNEN.
- **`d42` (karar gereği güncellendi):** T7 (S158'in örneği = S162 alanı): kart toplamı 900 ve taksit Ödenen 0 / 0 / 0 `elleYok`'a; 'Tahsil Edilen 0', 'Kalan 600', bakiye 600 AYNEN; T6 (satış kartı carinin
  tek borcu + iade — SK-37): taksit Ödenen 300 / 0 ve gecikmiş 0 `elleYok`'a; 'Tahsil Edilen 300', 'Kalan 300', bakiye AYNEN.
- **`d43` / `d30` (adıma seçenek — Y17-4):** d43 `u1k` / `u2k` ve d30 `q1k` / `q3k` / `q5k` `fazlasiniAvansYaz: true`; d43 KU1 / KU2 'Tahsil Edilen' `elleYok`'tan 1.100 / 600'e (S154 B), S144 kayıtları kalktı;
  d30'un beklentileri DEĞİŞMEDİ (KQ1 / KQ3 S144 susması aynen).
- **İlk koşu (açıkça):** d45'in 115 elle denetiminin HEPSİ ve d30 / d42 / d43 / d44'ün güncellenmiş elle tabloları (331) yeni kâhinle ilk koşuda aynı; hiçbir elle değer kâhine göre düzeltilmedi.

### C10u Mutantlar (bakım 17; `oz-test.py` DEĞERLE — çökmeden, elle tablo kırmızı; senaryo listesi KOŞUDAN — bütün /3 elle senaryolar × 303–307)
303 (d44 X12 — 3 elle değer; d45 Z5 — 2) · 304 (d43 U1 / U2 'Tahsil Edilen' — 2; d45 A1 / A2 — 8) · 305 (d30 Q1 / Q3 / Q5 — 14: seçenek yok sayılınca sınır bölgesindeki adım SK-36 ile susar; d43 U1 / U2 / U2F — 11;
d45 A1 / A6B — 16) · 306 (d43 U1 / U2 — 2; d45 A1 — 1) · 307 (d45 A5 — 7; d30 / d31 / d32 KQ4 — 5 / 5 / 6: tek kuyruk ödeneni kartın avansla ödenmiş kısmını da içerdiğinden sınır kayar). Kod commit'indeki
elle listedeki "307 … d43" YANLIŞTI (koşu: d43'te 307 yakalanmıyor) — burada düzeltildi. Bakım 6 … 16 mutantları (200–302) aynen yakalanıyor (`oz-test.py`; `mutant-senaryo.py` 261–307 × d35 … d45).

### Dil ekleri (/3, bakım 17)
- **YENİ adım alanı:** `kart_tahsilat {kayit, tutar, tarih, fazlasiniAvansYaz}` — `fazlasiniAvansYaz: true` = 'Kalanı Aşan Tutar' sorusuna 'Fazlasını Avans Yaz'; alan yok / `false` = yanıt yok ya da
  vazgeçildi. Yalnız 2.5.0'da okunur. Kalanı aşmayan tahsilatta etkisiz.
- **RET'in görünümü:** `adim:<id>:durum` = `"ret"` (senaryo dosyasında `"elleBeklenen": {"adim:<id>:durum": "ret"}`); Kasa / bakiye / kart değerleri adım yokmuş gibi. İleti / kod denetlenmez.
- Yeni çıktı anahtarı YOK. `belirsiz` metinleri: "… KULLANICIYA SORULMALI SK-36 (§28 Y17-2)", "kart <no> göstergeleri kısmen tanımsız (2.5.0 §28): … BİLİNEN SINIR (kullanıcı kararı S162 = B) S162 (§28
  Y17-5)" | "… KULLANICIYA SORULMALI SK-37 (§28 Y17-5 …)", "cari <ad> açık kalem dağılımı tanımsız (2.5.0 §28 Y17-6): … S163 = C) S163", S144 metni C28.4. SK-35 metni artık yazılmaz.

### Eşleme notları (ana oturum için; `kos.mjs` bu bakımda DEĞİŞMEDİ — yalnız `kart_tahsilat` ve Vade Takip eşlemesi okundu)
- **`kart_tahsilat`:** koşucu bugün `POST /api/workspace/plans/<kart>/entries {kind, amount, date, method: "cash", cashForce: true, similarOk: true}` gönderiyor (okundu). `fazlasiniAvansYaz: true` iken
  programın 'Kalanı Aşan Tutar' sorusunun 'Fazlasını Avans Yaz' yanıtı istekle birlikte gönderilmeli; alan YOKKEN koşucu bu yanıtı göndermemeli (program soruyu soruyorsa istek reddedilmeli — adım
  "ret" okunur, Kasa / bakiye değişmez). Programın soruyu hangi alanla aldığı kâhinin bilgisi DEĞİL (ana oturum eşler).
- Adımı reddedilen kart tahsilatı (d45 A2 `ka2b`) koşucuda "ret" okunabilmeli; SK-36'nın iki dünyası (d45 A6) `elleYok` ile — koşucu o adımı göndersin, kâhin o carinin ayrışan denetimlerini yazmaz.
- **Ana oturuma:** `model.py` değişti — mobil yazma kâhininin `cari_model_sha256`'sı yeniden üretilmeli (o dosya okunmadı); yapım aşaması listesi bu ajanca açılmadı ('eşleme' kayıtları seçenek
  eşlemesiyle kapanmalı; S159 / S162 / S163 / S154 alanındaki yeni değerler ve kalkan beklentiler DEĞİŞEN / YENİ / KAPANAN görünebilir — ayrıştırma ana oturumda).
- **Ana oturuma NOT (kâhinin kuralı değil, açıkça):** S151 KARAR'ı "İade faturasıyla yapılan iadede kart küçülür" diyor; kâhin iade faturasının ARTANININ satış kartı olmayan kartı kapattığı durumda
  `kart:<no>:toplam`'ı asıl tutarla yazar (bakım 15 / 16 — elle senaryo YOK; S162'nin alanı FATURASIZ iadeyle sınırlı). Bu durum bir senaryoda oluşursa önce bakılmalı.

### C12u DENENMEYEN (bakım 17; neden)
- Program koşulmadı (görev). Programın 'Kalanı Aşan Tutar' sorusunun alanı, ret yanıtı (HTTP kodu / ileti), S162 / S163 alanındaki gösterimi bilinmiyor.
- S163: kart adımından SONRA girilen geriye tarihli kayıtla kapanan eski elle borç (kâhin ölçüyü kart adımı anında alır); borçlu Açılış kapanmış elle borç olarak; iki S120 kartı; S163 alanında
  Ödeme Sözü taşıyan kalem — elle senaryo yok.
- S162: iade faturası (faturalı) iadesi; Değersiz; birden çok kart; iade kartın açığından büyük (artan avans) — elle senaryo yok (kural yolu aynı: alan yalnız faturasız stok iadesi ile kurulur).
- Seçenek: Tablodan Aktar kartı (taşınan tahsilatlı) kalanı aşan tahsilat; şüpheli kayıtlı caride seçenekli tahsilat (S155 ile birlikte); sınır bölgesinde S101'in SK-14 alanı (d30 Q5 — cari
  tanımsız, yalnız bakiye) dışında avansla ödenmiş kart — elle senaryo yok. Rastgele üretici seçenek üretmiyor ve kalanı aşan kart tahsilatı üretmiyor (tarama: 0) — üretici değişmedi.
- S150: alan yok (Y17-9). İki şirket / yedek geri yükleme bu bakımın kurallarıyla.

### C0u Değişen eski beklentiler (G3; bakım 16 (`kahin17-taban` = f61f058e) ↔ bakım 17 kâhin çıktısı, `2.5.0`; eski kopyanın 98 elle senaryosu + d45 + seçenek eklenmiş d30 / d43'ün yeni hâli + rastgele s1 / ux18 tohum 1–10 × 120) — kararla ilgisiz eski beklenti DEĞİŞMEDİ
Eski 50.516 → yeni 50.454 denetim; değişen / kalkan / yeni toplam **140**; **BEKLENMEYEN 0**; yalnız etiketi değişen 13 (dökümü `docs/kanit/2026-11-13/kahineski17-g3-dokum-*.json` — iki saat diliminde
bayt bayt aynı; özet `kahineski17-esdeger-cari-*.log`). Sınıf yeni modelin `_iz15` izinden cari cari; anahtar türü sınıfın alanında olmak zorunda:
- **S118 (59: 26 değişen + 27 kalkan + 6 yeni):** ESKİ (seçeneksiz) d43 U1 / U2 yeni kâhinde RET (17 değişen + 5 yeni — `adim:u1k:durum` "ok" → "ret", U1 bakiye / açık toplamı, U2F açığı yeniden yazılır), ESKİ d30
  Q1 / Q3 / Q5 sınır bölgesinde SUS (15 kalkan — iki dünya), d45 A2 (RET — eski kâhin kabul ediyordu) ve A6 (SK-36 SUS) (9 değişen + 12 kalkan + 1 yeni). Seçenek eklenmiş d30'un yeni hâli: fark 0.
- **S154 (3 yeni):** d45 A1 KA1 'Tahsil Edilen' 130000; d43'ün yeni hâlinde KU1 110000, KU2 60000 (eski kâhinde S144 SUS).
- **S159 (14 yeni):** d44 X12 7 (bakım 16 SK-35 iki dünyası — adımın durumu, bakiye, gecikmiş, x12a kalemleri), d45 Z5 7 (çekle aşan — eski kâhinde SK-35).
- **S162 (19 kalkan):** d42 T7 / T6 9 (kart toplamı, taksit Ödenen, gecikmiş — T6 SK-37), d44 Y4 5, d45 B1 5.
- **S163 (37 kalkan):** d45 C1 / C3 (açık kalem dağılımı; C1'de gecikmiş — C3'te gecikmiş yazılı kalır).
- **GENEL (8: 2 değişen + 4 kalkan + 2 yeni):** aynı kontrolde sınıflı değişiklik olan senaryoda Kasa / Kasa raporu (eski d43 U1 / U2 reddi Kasa'yı 1.700 düşürür; d30 / d45 iki dünyası Kasa'yı ayırır; d44 X12
  kabulü Kasa'yı geri getirir).
- **Öbür 94 eski elle senaryo ve 20 rastgele: fark 0** (adımları değişen eski senaryo 0 — d30 / d43'te yalnız `fazlasiniAvansYaz` eklendi; üretici 20/20 aynı dizi).
- **Eski ELLE tablolarda değişen beklentiler** (`kahineski17-elle-fark-*.log`, 98/98 izinli): d44 15 (X12 değerleri + SK-35 kaydı kalktı; Y4 taksit Ödenen / toplam / gecikmiş `elleYok`'a, S162 kaydı), d42 18
  (T7 / T6 — S162 / SK-37), d43 6 (KU1 / KU2 'Tahsil Edilen' değer, S144 kayıtları kalktı); d30 ve d43'te 3 + 2 adıma yalnız seçenek eklendi. Öbür 94 dosya AYNI.
- `--kural 2.4.9` / 2.4.6 / 2.4.5 / `--legacy`: **484/484 bayt bayt aynı** (98 eski elle + d45 + d30 / d43 yeni hâli + 20 rastgele × 4 kip).
- **Yeni / değişen elle tablolar ESKİ (bakım 16) kâhinde — beklenen NEDENLE kırmızı (ders 7, 38):** 446 elle denetimin **56**'sı (`kahineski17-kirmizi-eski-cari-*.log`; d45 34, d42 11, d44 9, d43 2, d30 0):
  S159 alanında "ANAHTAR YOK" (SK-35 iki dünyası — d44 X12, d45 Z5), seçenek bilinmediğinden kabul (d45 A2 `ret` ↔ eski "ok", bakiye 700 ↔ −100), S154 'Tahsil Edilen' "ANAHTAR YOK" (KA1, KU1, KU2), SK-36 /
  S162 / S163 alanında değer yazması (A6 durum / bakiye; KB1 / KT7 / KT6 / KY4 toplam, taksit Ödenen, gecikmiş; C1 / C3 dağılımı), yeni neden metinleri `belirsiz`'de yok (7); 390'ı iki kâhinde aynı (d30'un
  138'i dahil — seçenek o senaryonun beklentilerini değiştirmedi).

### Kanıt (bakım 17; iki saat dilimi — UTC ve Europe/Istanbul çıktıları başlık / kanit satırları dışında bayt bayt aynı, G3 dökümleri bayt bayt aynı; kâhin `750d066b`, temiz ağaç; `docs/kanit/2026-11-13/kahineski17-*`, araçlar ve koşu betiği `kahineski17-arac/`)
cari öz test **6.514/6.514** (`-cari-oz-*`: elle tablolar 99 senaryo, mutantlar 200–307 — 219–307 değerle) · mutasyon taraması **274/274** (`-cari-mutasyon-*`) · eşdeğerlik + G3 **603/603** (`-esdeger-cari-*`) ·
yeni / değişen elle tablo **446/446** (`-elle-yeni-cari-*`: d45 115 + d30 138 + d42 77 + d43 40 + d44 76) · ESKİ kâhinde **56 kırmızı** / 446 (`-kirmizi-eski-cari-*`) · eski elle tablo farkı **98/98** izinli
(`-elle-fark-*`) · G1 tarama **99/99** (`-g1-tara-*`) · mutant ↔ senaryo **517/517** (`-mutant-senaryo-*`; d35 … d45 × 261–307) · geniş tarama **2.201/2.201** (`-genis-tarama-*`; bakım 16 ile aynı sayı) ·
defter öz testi **181/181** (`-defter-oz-*`; bu bakım defter kâhinine dokunmadı). Hepsi çıkış 0, iki saat diliminde aynı sayılar. Öz test, mutasyon, eşdeğerlik ve geniş tarama `flock -s -n …/olcum.lock`
ile (ders 52); her adım `timeout` sınırlı. Program açılmadı. Koşu günlükleri `kahineski17-kos-utc.txt` / `-ist.txt` (yük 1,83 / 2,42 — 4 çekirdek).

## 29. 2.5.0 Ç5 bakımı 18 — S165 = A (karttan tahsilat sınırı YALNIZ karttan alınan parayı sayar) + S118 = B'nin BAŞ MİMAR OKUMASI (avansla ödenmiş kısım sınırı küçültmez — bakım 17 SK-36 (a)) + S166 = B (BİLİNEN SINIR — bakım 17 SK-37 susması) (13.11.2026, `date -u` 18:02; kararlar 13.11.2026 17:48 / 17:45 UTC ve S118 (11.11.2026 06:14) — ana oturumun özet dosyası; eski kâhinler bakımı 18 — kodu görmeyen AYRI el; ÇOK KÜÇÜK bakım, TOPLU KÂHİN BAKIMI) — kural seti `2.5.0` = §13 + … + §28 + bu bölüm

Bu bakım bakım 17'nin iki TOPLU sorusunun (SK-36, SK-37) yanıtlarını işler. §13–§28'in öbür kuralları DEĞİŞMEZ. `--kural 2.4.9` (ve 2.4.6 / 2.4.5 / `--legacy`) AYNEN (seçenek alanı ≤ 2.4.9'da
okunmaz). Defter kâhini (`test/bagimsiz/defter/`) DEĞİŞMEZ (reddedilen adım yevmiye yazmaz; S165 / S118 yalnız bir adımın kabul / ret sınırını, S166 yalnız neden metnini değiştirir). **Bu bölümün ilk
commit'i yalnız YORUMDUR (ders 40 — önce kural, sonra kod); senaryo / mutant / G3 sayıları kod ve kanıt commit'lerinde eklenir.**

### C00v Temiz oda (bakım 18)
- **Girdi (tek kaynak; ana oturumun özet dosyası `scratchpad/kahin-eski18-kararlar.md`; KURAL KAYNAĞI yalnız KARAR / OKUMA / SONUÇ / KAPSAM satırlarıdır — soru metnindeki "PROGRAM BUGÜN (koşuldu)"
  sözü beklenti kaynağı sayılmadı):**
  - S165 KARAR (13.11 17:48, AYNEN — "önerilerin uygun"): "S165 = A — karttan tahsilatta 'Kalanı Aşan Tutar' sınırı YALNIZ karttan alınan parayı sayar; faturasız iade (ve Değersiz yazma gibi para
    dışı pay) sınırı küçültmez (örnek: Borç 900 + Borç 500 → kart 900 → faturasız iade 300 → karta 700 sormadan KABUL, bakiye 400; ardından aynı karta 600 RET — kalan 200)."
  - S118 = B'nin OKUMASI (BAŞ MİMAR OKUMASI; kullanıcıya 13.11 17:45'te gösterildi — "soru değil"): "carinin avansıyla ödenmiş kısım sınırı KÜÇÜLTMEZ — S118'in örneğinde 100 avans varken sınır
    700'dür (600 değil). Bakım 17'nin SK-36 (a) örneği (tahsilat 1.000 → stoktan taksitli satış 600 → karta 300, soru yanıtsız) bu sınıfın uç hâlidir: kartın kendi kalanı 600 → 300 sınırın altında →
    soru çıkmaz, KABUL, bakiye −700." Dayanak S118 KARAR (11.11 06:14, AYNEN): "S118 = B — taksit tahsilatında 'Kalanı Aşan Tutar' / 'Kart Ödendi' sınırı, sorusu ve formda ÖNERİLEN tutar kartın
    KENDİ kalanından gelir; taksit satırlarındaki kuyruk kalanı 'cari avansı düşülmüş' gösterimi olarak kalır." S118'in örneği (soru metni): kart 1.000, karta 300 (kendi kalanı 700), carinin başka
    karttan 100 avansı tek kuyrukta bu kartın taksitine sayılıyor (taksit satırlarında kalan 600) — B: sınır 700.
  - SONUÇ (ana oturum, AYNEN): "bakım 17'deki K' okuması düşer — sınır K = kart tutarı − karta doğrudan bağlı tahsilatlar; ne avansla ödenmiş kısım ne para dışı (iade / Değersiz) pay K'yı küçültür.
    Bakım 17'de SK-36 nedeniyle susturduğun 'K' < tutar ≤ K, seçeneksiz' adımları KABUL olarak değer alır; tutar > K iken seçeneksiz adım RET (bakım 17'deki gibi). S154 = B'nin ve S144 (c)'nin öbür
    alt durumlarının susma / değer durumu bu kararla değişiyorsa tek tek yaz; karar metinlerinden tek biçimde çıkmayan yerde SUS ve sor."
  - S166 = B (13.11 17:48, "önerilerin uygun"; soru metni girdi dosyasında AYNEN — S162 = B'nin satış kartında da geçerli olup olmadığı; B "böyle kalsın — BİLİNEN SINIR; kod değişmez, kâhin bu alt
    durumda susar"). KAPSAM (ana oturum, AYNEN): "bakım 17'de SK-37 diye susturduğun alan aynen susar; yalnız neden metni 'BİLİNEN SINIR (kullanıcı kararı S166 = B)' olur. Bakiye iki okumada AYNI —
    bakiyede SUSMA (bakım 17'deki gibi)."
- **Birlikte okunan (kâhinin kendi belgesi):** bu dosyanın §28 (bütünü — Y17-2 / Y17-3 / Y17-4 / Y17-5, C28.2 / C28.3 / C28.4 / C28.6, SK-36 / SK-37), §27 Y16-8 / Y16-9 (S158 / S154), §26 Y15-7 /
  Y15-14 (S151 / S144), §25 S129 KARAR, §18 S101 (Y6-4 / Y6-5); `model.py` (`kart_tahsilat`, `kontrol` kart göstergeleri, `_sus17`, `kos` iki dünya `sus_s118`, `MUTASYONLAR`); d30 / d42 / d45 elle
  senaryoları; `oz-test.py`; `docs/kanit/2026-11-13/kahineski17-arac/` araçları. `kos.mjs` bu bakımda AÇILMADI (eşleme §28'in notuyla — adım alanı değişmiyor). Okunan dosyaların tam listesi (satır
  aralıklarıyla) ajan raporunda.
- **Okunmayan:** `server/**`, `client/**`, `bulut/**`, `packaging/**`, `tools/**` (yalnız `kanit.mjs` çalıştırılır), `docs/erp/C5-ACILIS-TASARIM.md`, `docs/erp/C5B-TYK-TASARIM.md`, `docs/devir/**`,
  `docs/2.5.0-IS-LISTESI*.md` (hiçbir sürümü), `test/bagimsiz/cari/YAPIM-ASAMASI.json`, iki kâhin klasörü dışındaki `test/**`, başka ajanların `docs/kanit/**` dosyaları (yalnız `kahineski17-arac/`
  araçları), git farkı / geçmiş içeriği. Program koşulmadı. CLAUDE.md "Açık iş"teki program durumu kural / beklenti kaynağı sayılmadı.

### Kâhinin BUGÜNKÜ (bakım 17, `kahin18-taban`) okuması — üç alanda (açıkça)
- **Sınır (Y17-2 / C28.2):** iki sayı — K = kart tutarı − karta doğrudan bağlı tahsilatlar; K' = K − kartın avansla ödenmiş sayılan kısmı (S101 `onceden`) − kartın taksitlerini kapatan para dışı pay
  (`pd`: faturasız stok iadesi, iade faturasının artanı, Değersiz). tutar ≤ K' → kabul; tutar > K → seçenekle kabul / seçeneksiz RET; **K' < tutar ≤ K** → seçenekle kabul (`_s154x` izi), seçeneksiz
  **SUS** (iki dünya; "KULLANICIYA SORULMALI SK-36 (§28 Y17-2)"). Örnekleri: d45 A6 (SK-36 (b) — S165'in kendi örneği; adımın durumu ve bakiye `elleYok`), d30 Q1 / Q3 / Q5 (SK-36 (a) sınıfı —
  bakım 17'de adıma seçenek eklendi, iki okumada kabul).
- **S154 / S144 (c) (Y17-3 / C28.4):** 'Tahsil Edilen' = karttan alınan paranın tamamı YALNIZ kart, K' = K olan bir 'Fazlasını Avans Yaz' adımıyla (tutar > K) kapandıysa ve kontrol anında avansla
  ödenmiş kısım 0 ise; adımda K' < K idiyse (para dışı pay ya da avansla ödenmiş kısım) ya da sınır bölgesinde seçenekli adım varsa (`_s154x`) S144 = C SUS.
- **S162 × satış kartı (Y17-5 / C28.6):** SUS anahtarları kart toplamı, taksit 'Ödenen', gecikmiş; neden "KULLANICIYA SORULMALI SK-37 (§28 Y17-5 — S140 A ↔ S162 B …)", iz `sk37`.

### Yorumlar (ders 40 — kararlardan; kod yazılmadan ÖNCE; baş mimar kullanıcıya gösterir)
- **Y18-1 — TEK sınır K (S165 = A + S118 = B OKUMASI):** karttan tahsilatın 'Kalanı Aşan Tutar' sınırı **K = kart tutarı − karta doğrudan bağlı tahsilatlar** (kartın önceki KABUL edilmiş Taksit
  Tahsilatları + Tablodan Aktar'ın karta taşıdığı tahsilatlar / önceden ödenen parça) — Y17-2'nin K'sı AYNEN; **K' okuması DÜŞER**. K'yı KÜÇÜLTMEYENLER (hepsi kararların sözü): (i) kartın
  avansla ödenmiş sayılan kısmı (S101 — S118 OKUMASI: "carinin avansıyla ödenmiş kısım sınırı KÜÇÜLTMEZ"; SK-36 (a)); (ii) carinin başka yerden (başka kartın fazlası, kart seçilmeden alınan tahsilat)
  gelip tek kuyrukta bu kartın taksitine sayılan parası (S118'in örneği "100 avans varken sınır 700"; S129'un örneği — zaten §28); (iii) para dışı pay: faturasız stok iadesi, **Değersiz Alacak Yaz** ve
  **iade faturasının artanı** (S165 "faturasız iade (ve Değersiz yazma gibi para dışı pay) sınırı küçültmez" — iade faturasının artanı kâhinin dilinde aynı para dışı pay sınıfıdır (§27 Y16-8: "iade
  faturası da iadedir"); 'gibi' ile kapsanır, tek okuma). **Kural (2.5.0):** (a) tutar ≤ K → soru YOK → adım KABUL (§13 C13.4 (3)); `fazlasiniAvansYaz` ETKİSİZ (verilse de verilmese de çıktı
  aynı — seçenekli ↔ seçeneksiz eşdeğer); (b) tutar > K ve `fazlasiniAvansYaz: true` → KABUL (Y17-2 (b) AYNEN — aşan kısım kâhinin tek kuyruğunda bağsız alacak / avans); (c) tutar > K ve seçenek
  yok → RET (Y17-2 (c) AYNEN — hiçbir satır yazılmaz, `adim:<id>:durum` "ret"). Eşitlik (tutar = K) (a)'dır (soru yok — §28 d45 A4 aynen). Kararın örneği AYNEN: Borç 900 + Borç 500 → kart 900 →
  faturasız iade 300 → karta 700: K 900 ≥ 700 → sormadan KABUL, bakiye 400; ardından aynı karta 600: K = 900 − 700 = 200 < 600, seçeneksiz → RET, bakiye 400 kalır ("kalan 200"). Etiket KULLANICI
  (S165 A; S118 B). SK-36 KALKAR — kâhinde sınırın iki okumalı bölgesi kalmaz (sus_s118 boş).
- **Y18-2 — bakım 17'de SK-36 ile susan / seçenekle kurtarılan adımların yeni hâli (tek tek):** (1) **d45 A6** (`ka6t`: K 900, K' 600, tutar 700, seçeneksiz — S165'in kendi örneği): SUS → **DEĞER =
  KABUL**; beklentiler A6B'nin (aynı adım seçenekli, bakım 17'de zaten kabul) değerleriyle AYNI: bakiye 400, 'Tahsil Edilen' 700 (iadenin payı sayılmaz — S158), 'Kalan' 0, taksit 'Ödenen' 300 / 300 /
  100, Borç Z Kalan 400, gecikmiş 0; SK-36 kaydı kalkar. (2) **d30 Q1 / Q3 / Q5** (`q1k` / `q3k` / `q5k`: K' < tutar ≤ K; bakım 17'de seçenek eklendi): beklentiler AYNI; seçenek artık ETKİSİZ —
  senaryo adımları DEĞİŞMEZ (alanı kaldırmak gereksiz; seçeneksiz hâlleri yeni elle senaryoda ayrıca — Y18-6). (3) d45 A6B (seçenekli sınır bölgesi): AYNI. Hâlâ susan sınır adımı: **YOK** (SK-36'nın
  iki alt durumu da tek okumaya indi). SK-36 (a) kararın sözüyle: tahsilat 1.000 → satış 600 (avansla 'Bitti') → karta 300 yanıtsız: K 600 ≥ 300 → KABUL, bakiye −700.
- **Y18-3 — S154 = B / S144 (c) ile etkileşim (tek tek; kart tahsilatının fazlası tek kuyrukta 'kartfazla' olan kartlar):** S154'ün alanı "'Fazlasını Avans Yaz' ile kapanan kart" = kartın en az
  bir Taksit Tahsilatı tutar > K iken seçenekle KABUL edildi (soru TEK okumayla soruldu).
  (1) **tutar > K seçenekli, adımda para dışı pay VAR, avansla ödenmiş kısım YOK** (bakım 17: K' < K → `_s154x` → S144 SUS): soru Y18-1 ile tek okumayla soruldu ve kart o adımla kapandı → **DEĞER
  (S154 B)**: 'Tahsil Edilen' = karttan alınan paranın TAMAMI (iade / Değersiz payı para olmadığı için sayılmaz — S158 / S165 / S154 aynı çizgi; tek okuma); 'Kalan' ve taksit 'Ödenen' tek kuyruktan
  (S129 / S158 — aynen). Örnek (S165'in örneğinin devamı, seçenekli): 700 KABUL sonra 600 'Fazlasını Avans Yaz' (K 200 < 600) → KABUL, 'Tahsil Edilen 1.300 · Kalan 0', bakiye −200.
  (2) **tutar > K seçenekli, kartın avansla ödenmiş sayılan kısmı (S101) > 0 (adımda ya da kontrol anında)**: kart FAY adımından ÖNCE avansla 'Bitti' sayılmıştı; kartın kuyruk fazlası S101'den de
  doğuyor — "'Fazlasını Avans Yaz' ile kapanan kart" mı "avansla kapanmış kart" mı ayırt edilemez; S165 / S118 yalnız SINIRI söyledi, 'Tahsil Edilen'in avansla ödenmiş kartta neyi saydığını
  söylemedi → **SUS AYNEN** (S144 = C BİLİNEN SINIR'ının içinde — S144 = C kartın kendi fazla tahsilatının 'Tahsil Edilen'ini zaten bilinen sınır yaptı; S154 yalnız 'Fazlasını Avans Yaz' yolunu
  ayırdı). Bakiye iki okumada AYNI (yalnız gösterge) → yeni soru DEĞİL (TOPLU kural: bakiyeyi değiştirmeyen alt durumda varsayılan BİLİNEN SINIR; S144 = C zaten o). Neden metni C28.4'teki S144
  metni + "(§29 Y18-3 (2) — avansla ödenmiş kart)".
  (3) **tutar ≤ K (soru yok) — kartın kuyruk fazlası S101'den** (d30 Q1 / Q3; yeni Q7): S154'ün alanı DEĞİL (soru sorulmadı) → S144 SUS AYNEN. Seçenek bu bölgede etkisiz olduğu için bakım 17'nin
  sınır bölgesi izi (`_s154x`) ARTIK KURULMAZ — sonraki bir tutar > K seçenekli adım (1) / (2)'ye göre değerlenir.
  (4) tutar > K seçenekli, ne para dışı pay ne avansla ödenmiş kısım (Y17-3'ün kendi alanı — d45 A1, d43 U1 / U2): DEĞER AYNEN.
- **Y18-4 — S166 = B:** Y17-5'in satış kartı kolu (satış kartı carinin TEK açık borcunu taşırken faturasız stok iadesi) **SUS AYNEN** — anahtarlar `kart:<no>:toplam`, `kart:<no>:taksit<i>:odenen`,
  `cari:<ad>:gecikmis`; DEĞER AYNEN: bakiye, `kart:<no>:kalan`, `kart:<no>:odenen` (iki okumada aynı), Kasa, görünüm toplamı. Yalnız neden metni: "KULLANICIYA SORULMALI SK-37 (…)" yerine
  "**BİLİNEN SINIR (kullanıcı kararı S166 = B) S166 (§29 Y18-4 — S162 = B satış kartında da)**"; iz `sk37` → `s166`. d42 T6'nın `elleBelirsiz` kaydı ["kart KT6", "SK-37"] → ["kart KT6", "S166 = B"].
  Etiket yok (susma).
- **Y18-5 — DEĞİŞMEYEN:** tutar > K adımları (seçenekli kabul / seçeneksiz RET — d45 A1 / A2, d43 U1 / U2); tutar ≤ K' adımları (bütün eski kart tahsilatları); S159 (Y17-1); S162 satış kartı olmayan
  kol ve S163 susmaları (Y17-5 / Y17-6); S144 (c)'nin Y18-3 (2) / (3) alt durumları; S141 / S143 / S149 / S156 / S157; `--kural 2.4.9` ve öncesi.
- **Y18-6 — yeni elle senaryolar (kâhin koşulmadan, karar metninden — kod commit'inde `d46`):** S165'in örneği AYNEN (700 sormadan KABUL, bakiye 400 → 600 seçeneksiz RET, bakiye 400); aynısının
  600 seçenekli hâli (Y18-3 (1) — S154 değer); SK-36 (a) seçeneksiz (KABUL, bakiye −700 — S118 OKUMASI) ve seçenekli K'yı aşan hâli (Y18-3 (2) — SUS) ve seçeneksiz K'yı aşan hâli (RET); S118'in
  kendi örneği (kart 1.000, karttan 300, başka karttan 100 avans: 700 seçeneksiz KABUL; 701 seçeneksiz RET; 701 seçenekli KABUL — fazlası avans). d45 A6 güncellenir (Y18-2 (1)); d42 T6 neden
  metni (Y18-4).

### Üç alanın alt durumları (açıkça)
| Alt durum | Bakım 17 | Bakım 18 |
|---|---|---|
| Kart tahsilatı K' < tutar ≤ K, seçeneksiz (para dışı pay — S165 örneği; d45 A6) | SUS (SK-36 (b)) | **DEĞER = KABUL** (Y18-1 (a)) |
| Kart tahsilatı K' < tutar ≤ K, seçeneksiz (avansla ödenmiş — SK-36 (a); S101) | SUS (SK-36 (a)) | **DEĞER = KABUL** (Y18-1 (a); S118 OKUMASI) |
| Kart tahsilatı K' < tutar ≤ K, seçenekli | kabul (`_s154x`) | kabul (seçenek etkisiz; iz yok) |
| Kart tahsilatı tutar > K, seçeneksiz / seçenekli | RET / KABUL | RET / KABUL (aynen) |
| S118'in kendi örneği (başka karttan avans kuyrukta karta sayılmış) | K = 700 (değer) | K = 700 (aynen; mutant 307 = S118 A) |
| S154: tutar > K seçenekli, adımda para dışı pay, avansla ödenmiş yok | SUS (S144) | **DEĞER = S154 B** (Y18-3 (1)) |
| S154: tutar > K seçenekli, avansla ödenmiş kısım > 0 | SUS (S144) | SUS (S144 = C aynen; Y18-3 (2)) |
| S144 (c): kart fazlası S101'den, soru yok | SUS | SUS (aynen) |
| S162 × satış kartı (carinin tek borcu kendi satışı + faturasız iade) | SUS — SK-37 | SUS — **BİLİNEN SINIR S166 = B** (metin) |

### KULLANICIYA SORULMALI (bakım 18)
- YOK — S165 / S118 OKUMASI / S166 kâhinin bu alanlarındaki bütün alt durumları tek okumaya indirdi; tek kalan iki okumalı yer (Y18-3 (2) — avansla ödenmiş kartta 'Fazlasını Avans Yaz' sonrası
  'Tahsil Edilen') bakiyeyi değiştirmiyor ve S144 = C BİLİNEN SINIR'ının içinde kalıyor (önceki bakımlarda sorulmuş alan — yinelenmedi).
- **GÖZLEM (soru değil — ana oturuma, açıkça; kod commit'inde senaryodan çıktı):** S118'in kendi örneğinde (d46 R2) başka kartın 'Fazlasını Avans Yaz' fazlası (100) tek kuyrukta büyük kartın
  1. taksitine sayılır → büyük kartın 'Tahsil Edilen'i 400 (S129 A — tek kuyruk; S118'in "taksit satırlarında kalan 600"ü), küçük kartın 'Tahsil Edilen'i 300 (S154 B — karttan alınan paranın
  tamamı); iki kartın 'Tahsil Edilen' toplamı (700) carinin karttan ödediği paradan (600) büyük görünür. Bakiye tek (600). İki karar da harfiyle bu sayıları veriyor (tek okuma) → kâhin DEĞER yazar.

### Kurallar (kod commit'i; yorumların `model.py`'deki karşılığı)
- **C29.1 `kart_tahsilat` (Y18-1) — yalnız `k250`:** K = `toplam` − Σ `tasinan` − `parca` (aynen); tutar > K: seçeneksiz → `("ret", "KULLANICI", "§28 Y17-2 / §29 Y18-1 …")`; seçenekli → kabul. Bakım 17'nin
  sınır bölgesi dalı (K' < tutar ≤ K → `sus_s118` / `_s154x`) KALKTI: tutar ≤ K her durumda kabul (seçenek etkisiz); bölgedeki adım yalnız G3 izi (`_iz15` "s165" para dışı pay varsa, yoksa
  "s118okuma") ve durum etiketi KULLANICI ("§29 Y18-1 …") alır. `sus_s118` artık dolmaz (C28.3'ün iki dünyası boş geçer).
- **C29.2 S154 izi (Y18-3):** tutar > K seçenekli adımda adım anındaki tek kuyrukta kartın avansla ödenmiş kısmı (`onceden[no]`) 0 ise `_s154` (para dışı pay olsa da — bakım 17'de `pd` > 0 iken
  `_s154x` idi; `_iz15` "s165"), > 0 ise `_s154x` (S144 = C SUS aynen). C28.4'ün kontrol koşulu (kontrol anında `onceden[no]` = 0) AYNEN.
- **C29.3 `_sus17` (Y18-4):** satış kartı kolunun neden metni "BİLİNEN SINIR (kullanıcı kararı S166 = B) S166 (§29 Y18-4 — S162 = B satış kartında da)"; iz `sk37` → `s166`. Susma anahtarları AYNEN.
- **C29.4 mutantlar:** 308 (S165 B — K'dan kartın taksitlerindeki para dışı pay da düşülür), 309 (S118 A dar — K'dan kartın avansla ödenmiş kısmı düşülür). 307 (S118 A — tek kuyruk Kalan'ı) AYNEN:
  S118'in A seçeneğinin ("kuyruk kalanı 600") harfi 307'dir — tek kuyruk ödeneni avansla ödenmiş kısmı ve para dışı payı da içerdiğinden 307 = 308 + 309 + (başka yerden gelen payın) birleşimi;
  309 yalnız S101 avans kolunu ayrı yakalar (SK-36 (a) sınıfı).
- `--kural 2.4.9` / 2.4.6 / 2.4.5 / `--legacy`: hiçbir yol değişmedi (C29.1 / C29.2 yalnız `k250`; C29.3 `kontrol`'ün `k250` dalında).

### C8v Nasıl bozulur? (bakım 18)
| # | Bozulma | Senaryo |
|---|---|---|
| Z207 | Para dışı pay (faturasız iade) kartın kendi kalanını küçültür — K ≥ tutar iken soru / ret (S165 B) | d46 A7 / A8 (700), d45 A6 (mutant 308) |
| Z208 | İadeden sonra kalan hesaplanırken karttan alınan önceki para düşülmez — 600 kabul edilir ("kalan 200") | d46 A7 (600 RET) (mutant 304) |
| Z209 | Avansla ödenmiş kısım kartın kendi kalanını küçültür (S118 A dar — SK-36 (a)) | d46 Q7 (mutant 309), d46 Q9 komşu |
| Z210 | Sınır tek kuyruk Kalan'ı — başka karttan gelen avans sınırı küçültür (S118 A — "600") | d46 R1 (mutant 307) |
| Z211 | Tam sınırın 1 kuruş fazlası seçeneksiz kabul / seçenekli ret | d46 R2 / R3 (mutantlar 304 / 305) |
| Z212 | Para dışı paylı kartta 'Fazlasını Avans Yaz' ile kapanınca 'Tahsil Edilen' kart tutarına kırpılır ya da susulur | d46 A8 (mutant 306) |
| Z213 | Avansla ödenmiş kartta 'Fazlasını Avans Yaz' sonrası 'Tahsil Edilen' yazılır (S144 = C alanı) | d46 Q8 (`elleYok`) |
| Z214 | S166 alanında satış kartı göstergeleri yazılır ya da neden metni soru diye kalır | d42 T6 (`elleBelirsiz` "S166 = B") |

### Senaryolar (bakım 18; elle tablolar — kâhin koşulmadan karar metinlerinden ve §29'dan; betik `docs/kanit/2026-11-13/kahineski18-arac/senaryolar18.py`)
- **`d46-c5-s165-s118-sinir`** (bugün 15.06.2026; 73 elle değer + 2 `elleYok` + 2 `elleBelirsiz` = 77 elle denetim): **S165** (Borç 900 + Borç Z 500 (vade 30.06) → kart 900 = 3 × 300 → faturasız stok iadesi
  300 → karta 700): A7 kararın örneği AYNEN — 700 sormadan KABUL (K 900), bakiye 400, 'Tahsil Edilen' 700, Kalan 0, taksit 300 / 300 / 100, Z Kalan 400, gecikmiş 0; ardından 600 seçeneksiz RET (K 200)
  — hepsi aynı kalır · A8 aynı 600 'Fazlasını Avans Yaz' → KABUL: bakiye −200, 'Tahsil Edilen' 1.300 (S154 B — Y18-3 (1)), taksit 300 / 300 / 300, Z Kalan 0. **S118 OKUMASI / SK-36 (a)** (tahsilat
  1.000 (01.05) → stoktan taksitli satış 600 (05.05; 2 × 300) → 10.05 karta): Q7 300 seçeneksiz → KABUL, bakiye −700, Kalan 0, taksit 300 / 300 ('Tahsil Edilen' S144 SUS) · Q8 700 seçenekli (K 600) →
  KABUL, bakiye −1.100 ('Tahsil Edilen' S144 SUS — Y18-3 (2)) · Q9 700 seçeneksiz → RET, bakiye −400. **S118'in kendi örneği** (Borç 1.000 + Borç 200 → kart 1.000 = 2 × 500 + kart 200 → büyük karttan 300 →
  küçük karta 300 'Fazlasını Avans Yaz' — fazla 100 büyük kartın 1. taksitine): R1 700 seçeneksiz → KABUL, bakiye −100, büyük kart 'Tahsil Edilen' 1.000 · Kalan 0 · R2 701 seçeneksiz → RET, bakiye 600,
  büyük kart 'Tahsil Edilen' 400 · Kalan 600 (taksit 400 / 0), gecikmiş 600 · R3 701 seçenekli → KABUL, bakiye −101, büyük kart 'Tahsil Edilen' 1.001 (S154 B); küçük kartlar 'Tahsil Edilen' 300 · Kalan 0.
- **`d45` (karar gereği güncellendi — Y18-2 (1)):** A6 (S165'in örneği; bakım 17 SK-36 SUS) → `adim:ka6t:durum` "ok", bakiye 400, gecikmiş 0, 'Tahsil Edilen' 700, Kalan 0, taksit 300 / 300 / 100, Z
  Kalan 400 (A6B ile aynı); SK-36 `elleYok` / `elleBelirsiz` kalktı.
- **`d42` (Y18-4):** T6'nın `elleBelirsiz` kaydı ["kart KT6", "SK-37"] → ["kart KT6", "S166 = B", "BİLİNEN SINIR"]; susma anahtarları (`elleYok`) ve değerler AYNEN.
- **`d30`:** DEĞİŞMEDİ (Q1 / Q3 / Q5'in seçeneği artık etkisiz — beklentiler aynı; seçeneksiz eşi d46 Q7).
- **İlk koşu (açıkça):** d46'nın 77 elle denetiminin HEPSİ ve d45 / d42'nin güncellenmiş tabloları (121 + 77) yeni kâhinle ilk koşuda aynı; hiçbir elle değer kâhine göre düzeltilmedi.

### C10v Mutantlar (bakım 18; `oz-test.py` DEĞERLE — senaryo listesi koşudan; KANIT commit'inde kesinleşir)
308 (d46 A7 / A8 — 11 elle değer; d45 A6 — 9) · 309 (d46 Q7 — 2) · 307 bu bakımda d46 A7 / A8 / Q7 / R1'de de (20) · 304 d46 A7 / Q9 / R2 (19) · 305 d46 A8 / Q8 / R1 … R3 (32) · 306 d46 A8 / KR1B … KR3 (5).
d30 artık 305 / 307 / 309'u yakalamıyor (seçenekli sınır adımı her okumada kabul) — bakım 17'deki 305 / 307 yakalamalarının d30 kolu düştü, mutantlar başka senaryolarda yakalanıyor.

### Dil ekleri (/3, bakım 18)
- Adım alanı DEĞİŞMEDİ (`kart_tahsilat {kayit, tutar, tarih, fazlasiniAvansYaz}`). `fazlasiniAvansYaz` yalnız tutar > K iken anlamlı; tutar ≤ K'de (para dışı pay / avansla ödenmiş kısım olsa da)
  ETKİSİZ. Yeni çıktı anahtarı YOK. `belirsiz` metinleri: SK-36 metni artık yazılmaz; SK-37 metni yerine "… BİLİNEN SINIR (kullanıcı kararı S166 = B) S166 (§29 Y18-4 — S162 = B satış kartında da)".

### Eşleme notları (ana oturum için; `kos.mjs` bu bakımda AÇILMADI ve DEĞİŞMEDİ)
- Koşucu eşlemesini etkileyen değişiklik YOK: adım alanı aynı. Beklenti değişti: kartın taksitlerinde para dışı pay / avansla ödenmiş kısım varken tutar ≤ K adımında program SORU SORMAMALI (koşucu
  seçeneği göndermese de adım kabul okunmalı); tutar > K'de §28 eşleme notu AYNEN.
- **Ana oturuma:** `model.py` değişti — mobil yazma kâhininin `cari_model_sha256`'sı yeniden üretilmeli (o dosya okunmadı); yapım aşaması listesi bu ajanca açılmadı (SK-36 alanındaki kalkan
  susmalar ve d46'nın yeni değerleri listede YENİ / DEĞİŞEN / KAPANAN görünebilir — ayrıştırma ana oturumda).

### C12v DENENMEYEN (bakım 18; neden)
- Program koşulmadı (görev). Programın 'Kalanı Aşan Tutar' sorusunu iade / avans varken sorup sormadığı bilinmiyor.
- S165'in "Değersiz yazma gibi para dışı pay" kolu ve iade faturasının artanı: kural yolu aynı (`pd` toplamı) ama elle senaryo yok (yalnız faturasız stok iadesi); mutant 308'in yakaladığı da yalnız
  stok iadesi kolu.
- Tablodan Aktar kartında (taşınan tahsilat / parça) para dışı paylı sınır; şüpheli kayıtlı caride seçenekli tahsilat; Y18-3 (2)'nin kontrol anında sonradan doğan avansla ödenmiş kısım kolu —
  elle senaryo yok. Rastgele üretici seçenek ve sınır bölgesi tahsilatı üretmiyor (bakım 17 taraması) — üretici değişmedi.

### C0v Değişen eski beklentiler (G3; bakım 17 (`kahin18-taban` = 261b1aec) ↔ bakım 18 kâhin çıktısı, `2.5.0`; eski kopyanın 99 elle senaryosu + d46 + rastgele s1 / ux18 tohum 1–10 × 120) — kararla ilgisiz eski beklenti DEĞİŞMEDİ
Eski 50.322 → yeni 50.357 denetim; değişen / kalkan / yeni toplam **35** (hepsi YENİ — bakım 17'nin SK-36 iki dünyasının sildiği denetimler artık yazılıyor; DEĞİŞEN 0, KALKAN 0); **BEKLENMEYEN 0**; yalnız
etiketi değişen 7 (sınır bölgesindeki kabul adımının durum etiketi §29 Y18-1). Döküm `docs/kanit/2026-11-13/kahineski18-g3-dokum-*.json` (iki saat diliminde bayt bayt aynı):
- **S165 (29 yeni):** d45 A6 12 (adımın durumu "ok", bakiye / açık toplamı 400, gecikmiş 0, a6x / a6z Kalan, kart göstergeleri 700 / 0 / 300 · 300 · 100, a6z projeksiyon kalemi); d46 A7 / A8 17 (ka7t / ka7u /
  ka8t durumları, bakiyeler, Z Kalan'ları ve kalemleri, KA7 / KA8 'Tahsil Edilen' 700 / 1.300 ve 3. taksit). **S118-OKUMA (2 yeni):** d46 Q7 (adımın durumu "ok", bakiye −700).
  **GENEL (4 yeni):** d45 / d46 Kasa ve Kasa raporu girişi (iki dünya Kasa'yı ayırıyordu).
- **Öbür 98 eski elle senaryo, d46'nın Q8 / Q9 / R1 / R2 / R3 carileri ve 20 rastgele: fark 0** (adımları değişen eski senaryo 0; üretici 20/20 aynı dizi; d30 Q1 / Q3 / Q5 seçenekli — aynı; d42 T6 yalnız
  `belirsiz` metni — denetim farkı yok).
- **Eski ELLE tablolarda değişen beklentiler** (`kahineski18-elle-fark-*.log`, 99/99 izinli): d45 12 (A6 — SK-36 `elleYok` / `elleBelirsiz` kalktı, 9 değer), d42 2 (T6 `elleBelirsiz` SK-37 → S166 = B). Öbür 97
  dosya AYNI.
- `--kural 2.4.9` / 2.4.6 / 2.4.5 / `--legacy`: **480/480 bayt bayt aynı** (99 eski elle + d46 + 20 rastgele × 4 kip).
- **Yeni / değişen elle tablolar ESKİ (bakım 17) kâhinde — beklenen NEDENLE kırmızı (ders 7, 38):** 275 elle denetimin **23**'ü (`kahineski18-kirmizi-eski-cari-*.log`; d46 13, d45 9, d42 1): hepsi ya
  "ANAHTAR YOK" (SK-36 iki dünyası — A6 / A7 / A8 / Q7 adımları ve ayrışan denetimleri; KA8 'Tahsil Edilen' — bakım 17'de `_s154x` ile S144 SUS) ya da yeni neden metninin `belirsiz`'de olmaması (KT6 "S166 =
  B"); 252'si iki kâhinde aynı (d46'nın Q8 / Q9 / R1 … R3 değerleri dahil — bakım 17 de K = K' ile aynı sonucu veriyordu).

### C10v Mutantlar — koşudan (kesin)
`oz-test.py` (DEĞERLE): 308 → 2 elle senaryo (d45 A6, d46 A7 / A8), 309 → 1 (d46 Q7); 303–307 aynen yakalanıyor (307 artık d45 A5 / A6 ve d46'da; d30'da değerle değil). `mutasyon-tara.py` (kos.mjs düzeni — herhangi
bir çıktı farkı): 308 d45 / d46, 309 d30 / d31 / d32 (etiket / iz farkı). Bakım 6 … 17 mutantları (200–307) aynen yakalanıyor (öz test 6.611/6.611; tarama 276/276).

### Kanıt (bakım 18; iki saat dilimi — UTC ve Europe/Istanbul çıktıları başlık / kanit satırları dışında bayt bayt aynı, G3 dökümleri bayt bayt aynı; kâhin `7434dd1f`, temiz ağaç; `docs/kanit/2026-11-13/kahineski18-*`, araçlar ve koşu betiği `kahineski18-arac/`)
cari öz test **6.611/6.611** (`-cari-oz-*`: elle tablolar 100 senaryo, mutantlar 200–309 — 219–309 değerle) · mutasyon taraması **276/276** (`-cari-mutasyon-*`) · eşdeğerlik + G3 **600/600** (`-esdeger-cari-*`) ·
yeni / değişen elle tablo **275/275** (`-elle-yeni-cari-*`: d46 77 + d45 121 + d42 77) · ESKİ kâhinde **23 kırmızı** / 275 (`-kirmizi-eski-cari-*`) · eski elle tablo farkı **99/99** izinli (`-elle-fark-*`) ·
G1 tarama **100/100** (`-g1-tara-*`) · mutant ↔ senaryo **637/637** (`-mutant-senaryo-*`; d30 + d35 … d46 × 261–309) · geniş tarama **2.201/2.201** (`-genis-tarama-*`; bakım 17 ile aynı sayı) · defter öz testi
**181/181** (`-defter-oz-*`; bu bakım defter kâhinine dokunmadı). Hepsi çıkış 0, iki saat diliminde aynı sayılar. Öz test, mutasyon, eşdeğerlik ve geniş tarama `flock -s -n …/olcum.lock` ile (ders 52); her adım
`timeout` sınırlı. Program açılmadı. Koşu günlükleri `kahineski18-kos-utc.txt` / `-ist.txt` (yük 1,17 / 2,06 — 4 çekirdek).

## 30. 2.5.0 Ç5 bakımı 19 — S162 = B'nin ÖLÇÜTÜ (iadenin YAZILDIĞI an; BAŞ MİMAR KARARI — d45 karşılaştırma örneğinin düzeltilmesi) + S170 = B (yetkiyle uygulanan karar — satış kartı + faturasız iade: kart toplamı ve iadenin kapattığı taksitin 'Ödenen'i SUS) + S157 = C carilerinde kart toplamı SUS + susan carinin türetilmiş toplam / özet anahtarları (yöntem) (13.11.2026, `date -u` 21:50; kararlar 13.11.2026 16:11 / 08:35 UTC, baş mimar kararı 21:21 UTC, yetkiyle uygulanan karar 21:29 UTC — ana oturumun özet dosyası; eski kâhinler bakımı 19 — kodu görmeyen AYRI el; ÇOK KÜÇÜK bakım, YENİ KURAL YOK) — kural seti `2.5.0` = §13 + … + §29 + bu bölüm

Bu bakım yeni kural getirmez: (1) ana oturumun bakım 17 girdisindeki belirsiz bir örneğin (S162'nin karşılaştırması — yazım sırası) düzeltilmesi, (2) üç bilinen sınır alanında (S170 = B, S157 = C, S166 = B)
eksik kalan susma. §13–§29'un öbür kuralları DEĞİŞMEZ. `--kural 2.4.9` (ve 2.4.6 / 2.4.5 / `--legacy`) AYNEN (bu bölümün bütün yolları yalnız `k250`). Defter kâhini (`test/bagimsiz/defter/`) DEĞİŞMEZ
(susma ve bir ölçütün zamanı yevmiyeyi değiştirmez). Mobil yazma kâhininin KURALI değişmez; kabul dosyası cari kâhininin çıktısından yeniden üretilir (madde 6). **Bu bölümün ilk commit'i yalnız
YORUMDUR (ders 40 — önce kural, sonra kod); senaryo / mutant / G3 sayıları kod ve kanıt commit'lerinde eklenir.**

### C00w Temiz oda (bakım 19)
- **Girdi (tek kaynak; ana oturumun özet dosyası `scratchpad/kahin-eski19-kararlar.md`; KURAL KAYNAĞI yalnız KARAR / KAPSAM / DÜZELTME satırlarıdır — soru metinlerindeki "program bugün" / "koşuldu" /
  "BUGÜN" sözü ve oradaki sayılar beklenti kaynağı SAYILMADI):**
  - **Madde 1 — S162 = B'nin kapsamı (BAŞ MİMAR KARARI 13.11.2026 21:21 UTC; ANA OTURUMUN HATASI — DÜZELTME):** S162 KARAR (kullanıcı 13.11 16:11, AYNEN; bakım 17'de verilmişti): "S162 = B — taksit kartı
    carinin borcunun tamamını taşıyorken faturasız stok iadesinde kart sondan küçülmeye DEVAM eder (bugünkü davranış; faturalı iadeyle aynı); BİLİNEN SINIR, kod değişmez." DÜZELTME (AYNEN özü): soru
    metnindeki KARŞILAŞTIRMA cümlesi ("cariye sonradan 500 borç daha yazılmışsa") yazım sırasını söylemiyordu; o gün gösterilen örnekte 500'lük borç İADEDEN ÖNCE yazılmıştı ("sonradan" = karttan sonra);
    bakım 17 bu örneği "iade ÖNCE, borç SONRA" sırasıyla kurdu (d45 B2) ve değer bekledi. KAPSAM (baş mimar; dayanak karar metni "kart carinin borcunun tamamını taşıyorken … iadede"): "ölçüt iadenin
    YAZILDIĞI andaki durumdur. (a) Faturasız iade yazıldığı ANDA kart carinin açık borcunun tamamını taşıyorsa alan S162 = B'nin BİLİNEN SINIRI'dır — iadeden SONRA cariye borç yazılması bunu DEĞİŞTİRMEZ:
    kart toplamı, taksit 'Ödenen'leri ve gecikmiş SUS (…; bakiye, 'Tahsil Edilen', 'Kalan' bakım 17'deki gibi yazılır — bakiyede SUSMA). (b) Karşılaştırma örneği DEĞERLE kalır ama doğru sırayla: Borç
    900 → Mevcut Borç kartı 900 (3 × 300) → cariye 500 borç daha (İADEDEN ÖNCE yazılır) → faturasız stok iadesi 300 ⇒ kart 900 kalır, iade İLK taksitten düşer ('1. taksit İade 300 · Kalan 0'),
    'Tahsil Edilen 0 · Kalan 600 · İade 300', gecikmiş 300. (c) Aynı karşılaştırmada 500'lük borcun TARİHİ iadenin tarihinden sonra, ama YAZIMI iadeden önce ise de (b) geçerlidir — ölçüt yazım sırasıdır,
    tarih değil." YAPILACAK: d45'in karşılaştırma carisi (b)'ye göre (adım sırası: borç iadeden önce); "iade önce, borç sonra" AYRI cari, (a)'ya göre SUS; (c) için komşu cari (değerle). Senaryo
    adımlarının listedeki sırası = yazım sırası.
  - **Madde 2 — S170 = B (yetkiyle uygulanan karar 13.11.2026 21:29 UTC — kullanıcı uzaktayken verdiği yetkiyle, 5 dakikalık bekleme sonunda ÖNERİ uygulandı; kullanıcı döndüğünde değiştirebilir):**
    "S170 = B — böyle kalsın, BİLİNEN SINIR; kâhin bu kartlarda 'toplam'da ve iadenin tamamen kapattığı / sondan kalkabilecek taksitlerin alanlarında SUSAR." Soru (özü): faturasız stok iadesinden sonra
    SATIŞ kartının 'Toplam Tutar'ı (caride başka borç da varken) ne göstersin — örnek S140'ın kendi örneği (elle Borç 500 + stoktan taksitli satış 1.000 (2 × 500) → faturasız iade 800; bakiye 700);
    komşular iade 1.000 ve 1.200. KAPSAM (ana oturum, AYNEN özü): "SATIŞLA açılan kartı olan caride FATURASIZ stok iadesi varsa — caride başka borç olsun olmasın — kartın 'toplam' anahtarı SUS;
    iadenin kapattığı taksitlerin 'Ödenen' anahtarı, o taksitin kartta kalıp kalmayacağı belirsiz olduğu için SUS. S140 = A'nın söylediği değerler AYNEN yazılır: taksit KALANLARI (örnekte [0, 200]),
    kartın 'Kalan'ı, 'Tahsil Edilen' (S151 = B: iade sayılmaz), gecikmiş, elle borcun kendi vadesi, bakiye. … susma YALNIZ 'toplam' ve 'kapanan taksitin Ödenen'i ile sınırlı; bakım 15–18'de bu
    senaryolarda yazdığın öbür değerler DEĞİŞMEZ."
  - **Madde 3 — S157 = C (kullanıcı 13.11 08:35; bakım 16'da verildi):** "S157 = C — üçü de BİLİNEN SINIR." KAPSAM (ana oturum): "bakım 16'da bu üç caride kartın 'Ödenen' / 'Kalan' ve ilgili alanlarında
    susuyorsun; aynı kartların 'toplam' anahtarı da AYNI nedenle SUS (madde 2 ile aynı gerekçe — kartın görünen toplamı bu alanda tanımsız). Bakiye yazılır."
  - **Madde 4 — KURAL (yöntem; baş mimar):** "bir caride kalem düzeyinde SUS'tuğun alanlardan TÜRETİLEN her toplam / özet anahtarı da SUS olur (ör. carinin takvim kalemlerinin pencere içi toplamı:
    kalemlerde susup toplamı 0 yazma). S166 = B carisinde … takvim toplamı bu yüzden SUS. Bütün senaryolarını bu gözle tara … bakiye bu kuralın DIŞINDA (bakiye her zaman yazılır)."
  - **Madde 5 (BİLGİ — kural değişmedi):** S169 = C (S129 = A ve S154 = B AYNEN); S171 = B (Vade Takip'te ELLE girilen aralık bugünkü gibi; hazır aralıklar S150 = A aynen).
- **Birlikte okunan (kâhinin kendi belgesi):** bu dosyanın §28 (bütünü — Y17-5, C28.6, Z204 / Z205, d45 B1 / B2), §29 (bütünü — Y18-4, C29.3), §26 Y15-5 / Y15-7 / Y15-16 / C26.4 / C26.5 (S140, S151,
  S149), §27 Y16-8 / Y16-10 / C27.2 / C27.3 (S158, S156 / S157); `model.py` (`_sus17`, `kontrol` kart göstergeleri, `_kapatici` / `stok_iade`, `kart_ac` S163 izi, S140 `hedef_kart`, `kontrol_v3` S149
  dalı, `kontrol_gorunum` `cariToplam`, `kontrol_acik_toplam`, `MUTASYONLAR`); d30 / d34 / d42 / d43 / d44 / d45 / d46 elle senaryoları; `oz-test.py`; `docs/kanit/2026-11-13/kahineski18-arac/` ve
  `kahinmobil2/arac/` araçları; mobil yazma kâhininin README'si (bakım 2 bölümü). `kos.mjs` bu bakımda AÇILMADI (adım alanı değişmiyor). Okunan dosyaların tam listesi (satır aralıklarıyla) ajan raporunda.
- **Okunmayan:** `server/**`, `client/**`, `bulut/**`, `packaging/**`, `tools/**` (yalnız `kanit.mjs` çalıştırılır), `docs/erp/C5-ACILIS-TASARIM.md`, `docs/erp/C5B-TYK-TASARIM.md`, `docs/devir/**`,
  `docs/2.5.0-IS-LISTESI*.md` (hiçbir sürümü), `test/bagimsiz/cari/YAPIM-ASAMASI.json`, üç kâhin klasörü dışındaki `test/**`, başka ajanların `docs/kanit/**` dosyaları (yalnız `kahineski18-arac/` ve
  `kahinmobil2/arac/` araçları), git farkı / geçmiş içeriği. Program koşulmadı. CLAUDE.md "Açık iş"teki program durumu kural / beklenti kaynağı sayılmadı.

### Kâhinin BUGÜNKÜ (bakım 18 + mobil bakım 2, `kahin19-taban` = 418a5d50) okuması — dört alanda (açıkça)
- **S162 ölçütü (C28.6):** KONTROL anında — etkin kartın taksitlerinde faturasız stok iadesi payı > 0 ve carinin tek kuyruğunda kart taksitleri DIŞINDA açık borç yönlü kalem YOK → SUS. d45 B2 (iade 10.06
  ÖNCE yazıldı, Borç 500 (12.06, vade 30.06) SONRA): kontrol anında Borç 500 açık → DEĞER (kart 900, taksit Ödenen 0 / 0 / 0, gecikmiş 300) — madde 1'e göre bu sıra (a)'dır (SUS).
- **S170 (satış kartı + faturasız iade):** S140 A alanında (d42 T1 / T2 / T3) kart toplamı ASIL tutarla (`kart:KT<n>:toplam` 100000) ve taksit 'Ödenen'leri (0 / 0) değerle yazılıyor.
- **S157 (SK-31 (a) / (b) / (c) — C13.4 (11) tanımsız cari):** kart göstergeleri yazılmıyor AMA `kart:<no>:toplam` (ve `var`) yazılıyor (d42 T4 / T5 / T8 — 100000).
- **Madde 4 taraması (bakım 18 kâhini; bütün elle senaryolar + rastgele s1 / ux18 tohum 1–10 × 120 — `belirsiz`'de adı geçen carinin hâlâ yazılan özet anahtarları, 45 kayıt):** S166 carisi (d42 T6)
  `takvim | vadeTakip | projeksiyon:cariToplam:T6` (taksit kalemleri — hangi taksitin açık kaldığı — SUS iken pencere toplamları yazılıyor); S149 carileri (d43 U4 / U6) `takvim:cariToplam` (takvim kalemi
  SUS iken); öbürleri (S144, S141, S162 / S163'ün Σ açık anahtarları, C16.4) aşağıda Y19-6'da tek tek.

### Yorumlar (ders 40 — kararlardan; kod yazılmadan ÖNCE; baş mimar kullanıcıya gösterir)
- **Y19-1 — S162 = B'nin ÖLÇÜTÜ: iadenin YAZILDIĞI an (BAŞ MİMAR KARARI 13.11 21:21; Y17-5 (2)'nin YERİNE):** her faturasız stok iadesi adımı (`stok_iade`) için, adımın yazıldığı ANDA (o ana kadar
  YAZILMIŞ bütün kayıtlarla — tarihleri ne olursa olsun; iadenin kendisi hariç) carinin tek kuyruğu kurulur: carinin en az bir etkin taksit kartı var VE kart taksitleri DIŞINDA açık (kalanı > 0) borç
  yönlü kalem YOK (Y17-5 (2)'nin süzgeci AYNEN: taksitsiz satış faturası, taksitli satış faturasının taksiti, elle Borç / borçlu Açılış, stok veresiye satışı, karşılıksız borç kalemi) → o iade
  **"kart carinin borcunun tamamını taşırken yazılmış iade"**dir; o anda etkin olan kartlar not edilir. **Alan (kontrol anında, her etkin taksit kartı için):** (1) kartın taksitlerinden en az birinin bir
  kısmını faturasız stok iadesi kapattı (tek kuyrukta para dışı pay "stok" > 0 — Y17-5 (1) AYNEN) VE (2) carinin, bu kart etkinken "borcun tamamını taşırken" yazılmış en az bir faturasız stok iadesi var →
  **BİLİNEN SINIR (kullanıcı kararı S162 = B; satış kartında S166 = B)**. SUS ve DEĞER anahtarları Y17-5 / Y18-4 AYNEN (SUS: `kart:<no>:toplam`, `kart:<no>:taksit<i>:odenen`, `cari:<ad>:gecikmis`; DEĞER:
  bakiye, `kart:<no>:kalan`, `kart:<no>:odenen`, Kasa) + Y19-6. **Kontrol anındaki durum ARTIK ölçü değildir** (KAPSAM (a): "iadeden SONRA cariye borç yazılması bunu DEĞİŞTİRMEZ"). Sonuçları (tek
  okuma — KAPSAM'ın harfi): (a) iade ÖNCE, Borç 500 SONRA → SUS (eski d45 B2'nin sırası); (b) Borç 500 (tarihi iadeden önce) ÖNCE yazılmış, sonra iade → DEĞER (kartın kendi kuralı — iade tek kuyrukta
  S2 sırasıyla; kararın örneğinde ilk taksit; kart 900, 'Tahsil Edilen 0 · Kalan 600', taksit 'Ödenen' 0 / 0 / 0 (S158 A), gecikmiş 300, bakiye 1.100); (c) Borç 500'ün TARİHİ iadeden sonra, YAZIMI önce →
  (b) AYNEN (tek kuyruk tarih sıralıdır: iadenin gününde Borç 500 doğmamıştır, iade ilk taksiti kapatır; ölçüt yazım sırasıdır). **Ölçütün öbür yönü (aynı harften):** iade yazılırken carinin başka açık
  borcu VARDI, kontrol anında YOK (ör. o borç iadeden sonra silindi) → iade "borcun tamamını taşırken" yazılmadı → DEĞER (Y17-5'in kontrol anı ölçüsünde SUS idi). **Kart iadeden SONRA açıldıysa**
  (iade yazılırken kart yoktu): (2) sağlanmaz → S162 alanı DEĞİL (kâhinin öbür kuralları aynen — Y7-2 (3) EK-2B 32 tanımsızlığı vb.). Aynı caride birden çok iade: biri (2)'yi sağlıyorsa alan. Etiket
  yok (susma); değerler BAŞ MİMAR (ölçüt) + mevcut etiketleri.
- **Y19-2 — S170 = B (yetkiyle uygulanan karar 13.11 21:29; kullanıcı döndüğünde değiştirebilir):** **alan:** etkin SATIŞ kartı (stoktan taksitli satışla açılan kart — `stok_satis_taksit`) olan cari +
  o carinin en az bir etkin faturasız stok iadesi (KAPSAM'ın harfi: "SATIŞLA açılan kartı olan caride FATURASIZ stok iadesi varsa — caride başka borç olsun olmasın"; iadenin karttan önce ya da sonra
  yazılmış olması ayrılmaz — tek okuma). **SUS:** (i) carinin her etkin satış kartının `kart:<no>:toplam`'ı; (ii) o kartın, tek kuyrukta faturasız stok iadesi payı > 0 olan (iadenin — tamamen ya da
  kısmen — kapattığı) her taksitinin `kart:<no>:taksit<i>:odenen`'i (kararın "iadenin tamamen kapattığı / sondan kalkabilecek taksitler" sözü + KAPSAM'ın "iadenin kapattığı taksitler"i: kısmen kapatılan
  taksit de sondan küçülebilir — tek okuma SUS). **DEĞER (AYNEN):** taksit kalanları (kâhinin dilinde `kart:<no>:kalan` + iadenin dokunmadığı taksitlerin 'Ödenen'i — taksit kalanı ayrı anahtar değil),
  `kart:<no>:kalan`, `kart:<no>:odenen` ('Tahsil Edilen' — S151 B: iade sayılmaz; KAPSAM açıkça yazdırıyor), gecikmiş, elle borcun kendi kalemi / vadesi, bakiye, Kasa; S166 alanında (satış kartı carinin
  tek borcu) Y18-4'ün susması AYNEN (o alanda bütün taksit 'Ödenen'leri ve gecikmiş de SUS). C13.4 (11) tanımsız cari (SK-31 (a) / (b) / (c), EK-2B 32): göstergeler zaten yazılmıyor; `toplam` da SUS.
  Neden metni: "kart <no> toplamı ve iadenin kapattığı taksitlerin 'Ödenen'i tanımsız (2.5.0 §30 Y19-2): satışla açılan kart + faturasız stok iadesi — BİLİNEN SINIR (kullanıcı kararı S170 = B; yetkiyle
  uygulanan karar) S170". Bakım 15–18'de bu senaryolarda yazılan öbür değerler DEĞİŞMEZ.
- **Y19-3 — S157 = C carilerinde kart toplamı:** C13.4 (11) tanımsızlığının nedeni S157 (SK-31 (a) / (b) / (c) — §27 Y16-10) olan carinin bütün etkin kartlarının `kart:<no>:toplam`'ı SUS (bakım 16'da
  bu carilerin kartlarında 'Ödenen' / 'Kalan' / taksit 'Ödenen' zaten yazılmıyor — "aynı kartlar"; KAPSAM'ın gerekçesi "kartın görünen toplamı bu alanda tanımsız"). `kart:<no>:var` (kart listede)
  ve bakiye DEĞER (AYNEN). SK-31 alanı satış kartı + faturasız iadedir → Y19-2'nin alanı da aynı kartları kapsar (iki neden birlikte yazılabilir). Neden metni: "… BİLİNEN SINIR (kullanıcı kararı S157 = C)
  S157 (§30 Y19-3 — kart toplamı)".
- **Y19-4 — madde 4 (türetilmiş toplam / özet anahtarı) — kural ve ölçüsü:** kalem düzeyinde SUS'tuğu bir alanın değerinden (hangi kalemin açık / ne zaman / pencerede olup olmadığı) HESAPLANAN carinin
  toplam / özet anahtarı da SUS. Ölçü: anahtar SUS'lu kalem bilgisini KULLANIYOR mu (kullanmıyorsa — yalnız yazılan kalemlerden ya da bakiyeden türüyorsa — DEĞER kalır); **bakiye her zaman yazılır**.
  Kâhinin özet anahtarları: `takvim | vadeTakip | projeksiyon:cariToplam:<ad>` (görünümün PENCERE İÇİ kalem toplamı), `cari:<ad>:gecikmis`, `cari:<ad>:acikToplam` / `acikEsitBakiye` (carinin açık fatura +
  elle kalemlerinin TAMAMININ işaretli toplamı — Σ açık = bakiye değişmezi), sayaçlar (`takvim:cariKalemSayisi`, `projeksiyon:cari` — kontrol geneli), kart düzeyinde `kart:<no>:odenen` / `kalan`.
- **Y19-5 — madde 4'ün SUS'a çevirdikleri (tarama + kuralın alanı):** (1) **S162 / S166 alanındaki cari:** `takvim | vadeTakip | projeksiyon:cariToplam:<ad>` — pencere içi toplam taksit kalemlerinin
  hangisinin açık kaldığından (vadesinden) türüyor; kalemler (taksit 'Ödenen'leri, gecikmiş) SUS → SUS (kararın kendi örneği d42 T6: takvim 0 — "takvim toplamı bu yüzden SUS"). (2) **S163 alanındaki
  cari:** aynı üç `cariToplam` — açık kalem dağılımı (fatura açığı ↔ taksit, elle Kalan) SUS iken pencere toplamı dağılıma bağlı (Y17-6'da "kalemler toplamı (`cariToplam` …) yazılıyorsa DEĞER" denmişti;
  madde 4 PENCERE toplamını açıkça SUS'a koyuyor — Y17-6'nın bu parçası DÜŞER). (3) **S149 alanındaki cari (§26 Y15-16 — takvim kalemi SUS):** `takvim:cariToplam:<ad>` — kalemin takvimdeki yeri (söz
  günü ↔ vade) tanımsız, pencereye girip girmediği de; Vade Takip ve projeksiyon kalemleri S149'da YAZILIYOR → onların `cariToplam`'ı DEĞER kalır. (4) Sayaçlar (`takvim:cariKalemSayisi`,
  `projeksiyon:cari`): S163 alanında elle kalem dağılımı SUS → o kontrolde sayaç yazılıyorsa SUS (taramada S162 / S166 / S163 / S149 alanlı kontrolde sayaç YAZILMIYOR — kart / S110 / S149 dalları
  sayımı zaten kesin saymıyor; kural yine yazılır). (5) S170 alanı: SUS'lu olan kart toplamı ve iadenin kapattığı taksitin 'Ödenen'idir; kalanlar ve vadeler DEĞER → pencere toplamları / gecikmiş
  bunlardan türüyor → DEĞER.
- **Y19-6 — madde 4'te DEĞER kalanlar (açıkça; tarama kayıtlarının hepsi):** (a) S162 / S166 / S163 carisinin `acikToplam` / `acikEsitBakiye`'si — kâhinde bu anahtar carinin açık fatura + ELLE kalemlerinin
  TAMAMINI toplar (taksit kalemlerini değil); S162 / S166'da SUS'lu taksit bilgisini kullanmıyor; S163'te KAPSAM'ın kendi sözü "bakiye, kalemler toplamı … SUSMAZ" (Σ bütün açık kalemler dağılımdan
  bağımsız — Y17-7) → DEĞER. (b) S163 carisinde BÜTÜN açık kalemlerin vadesi geçmişken gecikmiş (= Σ açık = bakiye − R; KAPSAM "BUGÜNKÜ toplam gecikmiş SUSMAZ") → DEĞER. (c) S144 = C carisi (kartın
  'Tahsil Edilen'i SUS — d30 Q1 / Q3, d46 Q7 / Q8): gecikmiş / `acikToplam` taksit kalanlarından ve kalemlerden türüyor ('Tahsil Edilen'den değil) → DEĞER. (d) S141 = C (fatura BELGE açığı SUS — d43 U2):
  gecikmiş takvim kalemlerinden (yazılıyor) → DEĞER. (e) C16.4 (gecikmiş tanımsız — d33 T12b): `acikToplam` yazılan kalemlerden → DEĞER (bu bakımın alanı değil). (f) S162 / S166 / S170 carisinin
  `kart:<no>:odenen` ('Tahsil Edilen') — taksit 'Ödenen'lerinin toplamıdır ama KAPSAM'lar (madde 1: "'Tahsil Edilen' … bakım 17'deki gibi yazılır"; madde 2: "'Tahsil Edilen' (S151 = B) AYNEN")
  açıkça yazdırıyor ve iki okumada aynı → DEĞER. (g) S149 carisinin `vadeTakip | projeksiyon:cariToplam` — kalemleri yazılıyor → DEĞER.
- **Y19-7 — DEĞİŞMEYEN:** S162 / S166 alanının SUS / DEĞER anahtarları (yalnız alanın ÖLÇÜTÜ değişti); S163 alanı (yalnız pencere toplamı eklendi); S140 A / S151 B / S158 A değerleri (Y19-2'nin iki
  anahtarı dışında); S144 / S143 / S141 / S149 (takvim toplamı dışında) / S156 / S157 (toplam dışında) susmaları; S159 / S165 / S118 / S154; `--kural 2.4.9` ve öncesi. Madde 5: S169 = C beklenti
  değiştirmez (S129 A / S154 B aynen); S171 = B — kâhinde elle girilen Vade Takip aralığı için beklenti YOK (koşucu Vade Takip'i yalnız 'Tüm Açık' ile okur — §28 Y17-9) → değişen bir şey yok.
- **Y19-8 — elle senaryolar (kod commit'inde; kâhin koşulmadan karar metinlerinden):** d45 B2 (b)'ye göre (Borç 500 iadeden ÖNCE yazılır ve tarihlenir); yeni B3 (a) — eski B2'nin sırası (iade önce, borç sonra)
  SUS; yeni B4 (c) — Borç 500'ün tarihi iadeden sonra, yazımı önce — değerle; yeni B5 — Borç 500'ün VADESİ kartın ilk taksitinden ÖNCE (iade S2 sırasıyla önce o borcu kapatır; kart dokunulmaz — "iade her
  zaman ilk taksitten" mutantını değerle ayırır); yeni B6 — ölçütün öbür yönü (Borç 500 iadeden önce yazıldı, iadeden sonra silindi — DEĞER). d42 T1 / T2 / T3 (S170 — kart toplamı ve iadenin kapattığı
  taksitlerin 'Ödenen'i `elleYok`'a), T4 / T5 / T8 (S157 — toplam `elleYok`'a), T6 (madde 4 — üç `cariToplam` `elleYok`'a); d30 Q7 (S170 alanı — satış kartı + faturasız iade; iade karttan önce, cari
  EK-2B 32 tanımsız: toplam `elleYok`'a); d43 U4 / U6 (madde 4 — `takvim:cariToplam` yazılıyorsa `elleYok`'a). Değerleri değişen eski elle beklenti YOK (yalnız SUS'a dönenler).

### KULLANICIYA SORULMALI (bakım 19)
- YOK — dört maddenin alanındaki her alt durum KARAR / KAPSAM metinlerinin harfiyle tek okumaya iniyor (Y19-1 … Y19-6); tek okumaya inmeyen yeni bir alt durum çıkmadı. Önceki bakımlarda sorulmuş alanlar
  (SK-31 / S157, S144, S149, S166, S163) yinelenmedi.

### Kurallar (kod commit'i; yorumların `model.py`'deki karşılığı)
- **C30.1 `_kapatici` (Y19-1) — yalnız `k250`, `stok_iade`:** adım kaydedilmeden ÖNCE (önbellek boşaltılarak) carinin tek kuyruğu kurulur; carinin etkin kartları ve kart taksitleri dışındaki açık borç
  yönlü kalemler (`_sus17`'nin süzgeci AYNEN: `tur` "n", kalanı > 0, `kart` boş ya da "fatura:") okunur → kapatıcıya `_s162 = {tum: <başka açık borç yok ve en az bir etkin kart var>, kartlar: [...]}`
  (yalnız iz; kuyruğun hesabını değiştirmez — bakım 17'nin `kart_ac` S163 izi düzeni). Mutant 312: iz kurulmaz.
- **C30.2 `_sus17` S162 / S166 kolu (Y19-1, Y19-5 (1)):** alan = kartın taksitlerinde stok iadesi payı > 0 VE carinin `_s162.tum` olan ve kartı `_s162.kartlar`'da taşıyan etkin bir faturasız stok iadesi
  var (mutant 312: bakım 17'nin kontrol anı ölçüsü). SUS anahtarları AYNEN + `takvim | vadeTakip | projeksiyon:cariToplam:<cari>`; neden metinleri AYNEN (S162 = B / S166 = B).
- **C30.3 `_sus17` S163 kolu (Y19-5 (2) / (4)):** SUS anahtarlarına `takvim | vadeTakip | projeksiyon:cariToplam:<cari>`, `takvim:cariKalemSayisi`, `projeksiyon:cari` eklendi (yalnız yazılmışsa silinir).
- **C30.4 `_sus17` S170 / S157 (Y19-2 / Y19-3):** etkin satış kartı (`satis` alanı dolu) + carinin etkin faturasız stok iadesi → `kart:<no>:toplam` ve stok iadesi payı > 0 olan taksitlerin
  `kart:<no>:taksit<i>:odenen`'i silinir (neden "… BİLİNEN SINIR (kullanıcı kararı S170 = B; yetkiyle uygulanan karar) S170", iz `s170`); tek kuyruğun tanımsızlık nedeninde "S157" geçen carinin
  her etkin kartının `kart:<no>:toplam`'ı silinir (neden "… S157 (§30 Y19-3 — kart toplamı)", iz `s157t`).
- **C30.5 S149 izi (Y19-5 (3)):** `kontrol_v3`'ün S149 dalı (takvim kalemi yazılmayan cari) `self._s149_k[<kontrol>]`'e cariyi ekler; `_sus17` o kontrolde `takvim:cariToplam:<cari>`'yi siler (iz `s149t`).
  Vade Takip / projeksiyon toplamları DEĞİŞMEDİ.
- **C30.6 mutantlar:** 310 (iade her zaman sondan küçültür — kart toplamı stok iadesi payı kadar küçülür; `kontrol`'ün `kart:<no>:toplam`'ı), 311 (iade her zaman ilk taksitten — faturasız stok iadesi
  S2 yerine carinin iadeden önce açılmış ilk kartının açık taksitlerine `hedef_kart`), 312 (S162 ölçütü kontrol anı — bakım 17).
- `belirsiz` kaydı yalnız gerçekten silinen denetim varsa yazılır (`_sus17` düzeni AYNEN). `--kural 2.4.9` / 2.4.6 / 2.4.5 / `--legacy`: hiçbir yol değişmedi (C30.1 yalnız `k250`; `_sus17` yalnız
  `k250`; C30.5 dalı yalnız `k250`; mutantlar yalnız `k250`).

### C8w Nasıl bozulur? (bakım 19)
| # | Bozulma | Senaryo |
|---|---|---|
| Z215 | Ölçüt kontrol anı: iadeden SONRA yazılan borç S162 alanını kaldırır (değer uydurulur) | d45 B3 (`elleYok`) |
| Z216 | Ölçüt kontrol anı: iadeden önce yazılıp sonra silinen borç alanı açar (değer susulur) | d45 B6 (mutant 312) |
| Z217 | Ölçüt tarih: borcun tarihi iadeden sonra diye (yazımı önce) alan açılır | d45 B4 (değerle) |
| Z218 | Başka borç varken iade de kartı sondan küçültür | d45 B2 / B4 / B6 (mutant 310) |
| Z219 | Faturasız iade S2 yerine hep kartın ilk taksitinden düşer | d45 B5 (mutant 311) |
| Z220 | Satış kartı + faturasız iadede kart toplamı / iadenin kapattığı taksitin 'Ödenen'i yazılır; Kalan / Tahsil Edilen / dokunulmayan taksit susulur | d42 T1 / T2 / T3, d30 Q7 |
| Z221 | SK-31 carisinde kart toplamı yazılır | d42 T4 / T5 / T8 |
| Z222 | Susan carinin pencere toplamı yazılır | d42 T6 / T7, d43 U4 / U6, d44 Y4, d45 B1 / B3 |

### Senaryolar (bakım 19; elle tablolar — kâhin koşulmadan karar metinlerinden ve §30'dan; betik `docs/kanit/2026-11-13/kahineski19-arac/senaryolar19.py`)
- **`d45` (madde 1 — bugün 15.06.2026; ortak yapı Borç 900 (15.04) → Mevcut Borç kartı 900 = 3 × 300, vadeler 06.05 / 06.06 / 06.07 (kart 20.04) → faturasız stok iadesi 300 (10.06); listedeki sıra =
  yazım sırası):** **B2 (b)** Borç 500 (01.06, vade 30.06) iadeden ÖNCE yazılır → kart 900, Kalan 600, Tahsil Edilen 0, taksit Ödenen 0 / 0 / 0, gecikmiş 300, bakiye 1.100 (değerler bakım 17'deki
  karşılaştırma değerleriyle AYNI — adımı düzeltildi) · **B3 (a)** iade önce, Borç 500 (12.06) sonra (eski B2'nin sırası) → toplam / taksit Ödenen / gecikmiş / pencere toplamları `elleYok`, Kalan 600, Tahsil
  Edilen 0, bakiye 1.100 · **B4 (c)** Borç 500'ün tarihi 12.06 (iadeden sonra), yazımı önce → B2 ile aynı değerler · **B5** Borç 500 (25.04, vade 01.05) önce → iade o borcu kapatır (Kalan 200), kart
  dokunulmaz: toplam 900, Kalan 900, taksit 0 / 0 / 0, gecikmiş 800, bakiye 1.100 · **B6** Borç 500 (01.06) önce, iadeden sonra silindi → B2'nin kart değerleri, gecikmiş 300, bakiye 600, `hareket:b6y:var`
  false; B1'e pencere toplamları `elleYok` (madde 4). 28 yeni elle değer + 8 `elleYok` + 1 `elleBelirsiz` (B3) + B1'in 3 `elleYok`'u.
- **`d42`:** T1 (iade 800 → 1. taksit 500 + 2. taksit 300) toplam + taksit 1 / 2 Ödenen, T2 (iade 300 → 1. taksit) toplam + taksit 1 Ödenen, T3 (iade 1.000) toplam + taksit 1 / 2 Ödenen `elleYok`'a (S170);
  T4 / T5 / T8 toplam `elleYok`'a (S157 — ayrıca S170 alanı); T6 / T7 pencere toplamları `elleYok` (madde 4); 6 `elleBelirsiz`. Dokunulmayan değerler (Kalan 200 / 700 / 0, Tahsil Edilen 0, T2 taksit 2
  Ödenen 0, gecikmiş, elle borç kalemleri, bakiye) AYNEN.
- **`d30`:** Q7 (iade 03.05 → satış kartı 05.05; cari EK-2B 32 tanımsız) toplam `elleYok`'a (S170 — KAPSAM'ın harfi: iadenin karttan önce yazılması ayrılmaz).
- **`d43`:** U4 / U6 `takvim:cariToplam` `elleYok` + 2 `elleBelirsiz` (madde 4 — S149). **`d44`:** Y4 pencere toplamları `elleYok` (madde 4 — S162).
- **İlk koşu (açıkça):** değişen beş elle tablonun 512 elle denetiminin HEPSİ yeni kâhinle ilk koşuda aynı (`elle-karsilastir.py`); hiçbir elle değer kâhine göre düzeltilmedi.

### Dil ekleri (/3, bakım 19)
- Adım alanı DEĞİŞMEDİ. Yeni çıktı anahtarı YOK. `belirsiz` metinleri: "kart <no> toplamı ve iadenin kapattığı taksitlerin 'Ödenen'i tanımsız (2.5.0 §30 Y19-2): … S170", "kart <no> toplamı tanımsız
  (2.5.0 §30 Y19-3): cari <ad> C13.4 (11) tanımsız (SK-31) — … S157 (§30 Y19-3 — kart toplamı)", "cari <ad> takvim pencere toplamı tanımsız (2.5.0 §30 Y19-5 (3)): … S149". S162 / S166 / S163 metinleri
  AYNEN (silinen anahtar listesi genişledi).

### Eşleme notları (ana oturum için; `kos.mjs` bu bakımda AÇILMADI ve DEĞİŞMEDİ)
- Koşucu eşlemesini etkileyen değişiklik YOK: adım alanı aynı; `hareket_sil` (d45 B6) mevcut adım. Senaryo adımlarının listedeki sırası = yazım sırası (koşucu adımları sırayla gönderiyor — §28 eşleme
  notu): d45 B2 / B4'te Borç 500 iadeden ÖNCE gönderilmeli (B4'te tarihi iadeden sonra).
- **Ana oturuma:** `model.py` değişti — mobil yazma kâhininin `cari_model_sha256`'sı ve kabul dosyası bu bakımda yeniden üretildi (madde 6; `test/bagimsiz/mobil-yazma/README.md` "2.5.0 bakımı 3").
  Yapım aşaması listesi bu ajanca açılmadı (S162 alanının ölçütü, S170 / S157 toplamları ve pencere toplamları listede KAPANAN / DEĞİŞEN görünebilir — ayrıştırma ana oturumda).

### C12w DENENMEYEN (bakım 19; neden)
- Program koşulmadı (görev). Programın iadenin yazıldığı andaki durumu okuyup okumadığı, sonradan silinen borçta (B6) kartı yeniden hesaplayıp hesaplamadığı bilinmiyor.
- S162 ölçütü: iki iade (biri borcun tamamı taşınırken, biri değil) aynı kartta; iade karttan ÖNCE yazılmış elle kart (S162 alanı değil — elle senaryo yok); geri yükleme / Silinenler'den geri gelen borç
  (iade yazılırken silinmişti); satış kartında (S166) yazım sırası komşusu — elle senaryo yok (kural yolu aynı).
- S170: satış kartında Değersiz / iade faturası artanı (S170 yalnız FATURASIZ stok iadesinde); iki satış kartı (SK-31 (b) — tanımsız); taksitli satış faturasının kendi kartı — elle senaryo yok.
- Madde 4: sayaç (`takvim:cariKalemSayisi`, `projeksiyon:cari`) S163 alanlı bir kontrolde hiç yazılmadı (taramada 0) — silme yolu senaryoyla denenmedi. Rastgele üretici satış kartı + faturasız iade
  üretmiyor (G3 rastgele farkı 0) — üretici değişmedi.

### C10w Mutantlar (bakım 19; `oz-test.py` DEĞERLE — senaryo listesi koşudan)
310 (iade her zaman sondan küçültür) → d45 B2 / B4 / B6 `kart:KB<n>:toplam` (3 elle değer) · 311 (iade her zaman ilk taksitten) → d45 B5 (`kart:KB5:kalan` 90000 ↔ 60000) + d45 A6 / A6B, d46 A7 / A8,
d34 E8, d35 H13 (başka borcun vadesi kartın taksitlerinden önce olan öbür cariler; 37 elle değer) · 312 (ölçüt kontrol anı) → d45 B6 (5 elle değer: toplam, taksit Ödenen, gecikmiş — "ANAHTAR YOK").
Karşılaştırma carisinde (b) / (c) (B2 / B4) "ilk taksitten" mutantı DEĞERLE AYRILAMAZ — kararın (b)'si iadenin İLK taksitten düşmesini söylüyor (beklenen = mutant); ayıran cari B5'tir (başka borcun
vadesi ilk taksitten önce — iade S2 sırasıyla o borcu kapatır). Bakım 6 … 18 mutantları (200–309) aynen yakalanıyor (öz test 6.678/6.678; tarama 279/279 — 310–312 dahil). Susma alanlarının (S170, S157,
madde 4) mutantı yok — `elleYok` / `elleBelirsiz` denetler (eski kâhin kırmızısı aşağıda).

### C0w Değişen eski beklentiler (G3; bakım 18 + mobil 2 (`kahin19-taban` = 418a5d50) ↔ bakım 19 kâhin çıktısı, `2.5.0`; eski kopyanın 100 elle senaryosu + yeni d45 + rastgele s1 / ux18 tohum 1–10 × 120) — kararla ilgisiz eski beklenti DEĞİŞMEDİ
Eski 50.797 → yeni 50.775 denetim; değişen / kalkan / yeni toplam **32** (27 kalkan + 5 yeni; DEĞİŞEN 0); **BEKLENMEYEN 0**; yalnız etiketi değişen 0. Döküm `docs/kanit/2026-11-13/kahineski19-g3-dokum-*.json`
(iki saat diliminde bayt bayt aynı). Kalkan (SUS'a dönen) her anahtar:
- **S162-OLCUT (madde 1 — 10 kalkan + 5 yeni):** eski d45 B2 (iade önce, Borç 500 sonra — (a)) `kart:KB2:toplam`, `kart:KB2:taksit1 | 2 | 3:odenen`, `cari:B2:gecikmis` (5 kalkan); yeni d45 B3 (aynı yapı) 5 kalkan;
  yeni d45 B6 (borç iadeden sonra silindi — eski kâhin kontrol anı ölçüsüyle SUS'luyordu) `kart:KB6:toplam`, `taksit1 | 2 | 3:odenen`, `cari:B6:gecikmis` 5 YENİ. B2 (b) / B4 (c) / B5: fark 0.
- **S170 (madde 2 — 12 kalkan):** d42 `kart:KT1:toplam`, `KT1:taksit1:odenen`, `KT1:taksit2:odenen`, `KT2:toplam`, `KT2:taksit1:odenen`, `KT3:toplam`, `KT3:taksit1:odenen`, `KT3:taksit2:odenen`,
  `KT4:toplam`, `KT5:toplam`, `KT8:toplam` (son üçü aynı zamanda madde 3 — S157; sınıflayıcı önce S170'i sayar); d30 `kart:KQ7:toplam`.
- **OZET (madde 4 — 5 kalkan):** d42 `takvim | vadeTakip | projeksiyon:cariToplam:T6` (S166 carisi); d43 `takvim:cariToplam:U4`, `takvim:cariToplam:U6` (S149).
- **Öbür 96 eski elle senaryo ve 20 rastgele: fark 0** (adımı değişen eski senaryo yalnız d45 — izinli; üretici 20/20 aynı dizi).
- **Eski ELLE tablolarda değişen beklentiler** (`kahineski19-elle-fark-*.log`, 100/100 izinli): d45 40 (B3 … B6 yeni, B1 / B3 pencere toplamı `elleYok`, adım: b2y iadeden önceye, tarihi 01.06), d42 34, d30 3, d43 4,
  d44 3 — hepsi madde 1–4; değeri değişen eski elle beklenti YOK (yalnız `elleBeklenen` → `elleYok` ve yeni kayıtlar).
- `--kural 2.4.9` / 2.4.6 / 2.4.5 / `--legacy`: **484/484 bayt bayt aynı** (100 eski elle + yeni d45 + 20 rastgele × 4 kip).
- **Yeni / değişen elle tablolar ESKİ (bakım 18) kâhinde — beklenen NEDENLE kırmızı (ders 7, 38):** 512 elle denetimin **37**'si (`kahineski19-kirmizi-eski-cari-*.log`; d45 11, d42 20, d30 2, d43 4, d44 0):
  B6 "ANAHTAR YOK" (eski kâhinin kontrol anı ölçüsü — 5), B3 değer yazması (5) + `belirsiz` yok (1), S170 / S157 alanında toplam ve taksit Ödenen yazması (12), pencere toplamlarını yazması (T6 3, U4 / U6 2),
  yeni neden metinleri `belirsiz`'de yok (9); 475'i iki kâhinde aynı. **Dişsiz kalanlar (açıkça):** d44 Y4 ve d45 B1 pencere toplamı `elleYok`'ları iki kâhinde de anahtar YAZILMADIĞI için kırmızı vermiyor
  (kontrolde `cariToplam` kurulmuyor — madde 4 kuralı orada yalnız güvence); B2 / B4 / B5'in değerleri iki kâhinde aynı (ölçütten bağımsız — B2 / B4'ün eski kâhinde de kontrol anında başka borç açık).
- **Madde 4 taraması (`kahineski19-ozet-tara-*.txt`, önce: `kahineski19-ozet-tara-bakim18.txt`):** bakım 18'de 45 kayıt → bakım 19'da 53 (5'i SUS'a döndü; 13'ü yeni `belirsiz` (S170 / B3) yüzünden listeye giren,
  Y19-6'ya göre DEĞER kalan Σ açık / gecikmiş anahtarları). Kalan 53'ün hepsi Y19-6 (a) … (g) sınıfında (S149'un Vade Takip / projeksiyon toplamları, S144 / S141 / C16.4 carileri, S162 / S166 / S163 / S170
  carilerinin `acikToplam` / `acikEsitBakiye` / gecikmiş'i).

### Kanıt (bakım 19; iki saat dilimi — UTC ve Europe/Istanbul çıktıları başlık / kanit satırları dışında bayt bayt aynı, G3 dökümleri ve madde 4 taraması bayt bayt aynı; kâhin `df767e9b`, temiz ağaç; `docs/kanit/2026-11-13/kahineski19-*`, araçlar ve koşu betiği `kahineski19-arac/`)
cari öz test **6.678/6.678** (`-cari-oz-*`: elle tablolar 100 senaryo, mutantlar 200–312 — 219–312 değerle) · mutasyon taraması **279/279** (`-cari-mutasyon-*`) · eşdeğerlik + G3 **605/605** (`-esdeger-cari-*`) ·
yeni / değişen elle tablo **512/512** (`-elle-yeni-cari-*`: d45 161 + d42 89 + d30 139 + d43 44 + d44 79) · ESKİ kâhinde **37 kırmızı** / 512 (`-kirmizi-eski-cari-*`) · eski elle tablo farkı **100/100**
izinli (`-elle-fark-*`) · G1 tarama **100/100** (`-g1-tara-*`) · mutant ↔ senaryo **676/676** (`-mutant-senaryo-*`; d30 + d35 … d46 × 261–312) · geniş tarama **2.201/2.201** (`-genis-tarama-*`; bakım 18 ile aynı
sayı) · defter öz testi **181/181** (`-defter-oz-*`; bu bakım defter kâhinine dokunmadı) · madde 4 taraması (`-ozet-tara-*`, çıkış 0). Hepsi çıkış 0, iki saat diliminde aynı sayılar. Öz test, mutasyon, eşdeğerlik
ve geniş tarama `flock -s -w 1800 …/olcum.lock` ile (ders 52 — kilit doluyken tek seferlik engelleyen bekleme, döngü yok); her adım `timeout` sınırlı. Program açılmadı. Koşu günlükleri
`kahineski19-kos-utc.txt` / `-ist.txt` (yük 0,42 / 0,74 — 4 çekirdek). Mobil yazma kâhini: kabul dosyası bu bakımın cari kâhiniyle yeniden üretildi (`test/bagimsiz/mobil-yazma/README.md` "2.5.0 bakımı 3").
