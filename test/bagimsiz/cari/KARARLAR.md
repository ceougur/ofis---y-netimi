# Bağımsız CARİ / EVRAK kâhini — kurallar ve kararlar (2.4.4 madde 31a, B1–B2)

Kural seti (06.11.2026): **`2.5.0`** varsayılan (2.4.9 + Ç5: açılış 519, KG-5, S49, tek yükümlülük kuyruğu S50 / S2 / ANINDA, B1 gecikmiş S52 — §13; bakım 2: S68 borç tarafı vade sırası, S67 takvim kalemi, S66 carisiz evrakın karşılıksızı — §14; bakım 3: S69 söz günü / söz geçmiş takvim kalemi — §15; bakım 4 (10.11.2026): S91 vadesiz kayıt kayıt gününde kalem, S92 net görünüm — karşı yönlü kalemler kendi belge tarihinde netleşir, S93 verilen avans gecikmişte — §16); (03.11.2026): **`2.4.9`** (2.4.6 + C1 hareketli cari silinemez — §12); 25.10.2026: **`2.4.6`** (2.4.5 + KS8–KS10 — §9; dil `/3` aynı, iki ek: `iade {geri}`, adımda `catal`); `--kural 2.4.5` 2.4.5 beklentilerini bayt bayt verir,
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
