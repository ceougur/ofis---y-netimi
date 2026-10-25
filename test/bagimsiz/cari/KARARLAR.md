# Bağımsız CARİ / EVRAK kâhini — kurallar ve kararlar (2.4.4 madde 31a, B1–B2)

Kural seti (25.10.2026): **`2.4.6`** varsayılan (2.4.5 + KS8–KS10 — §9; dil `/3` aynı, iki ek: `iade {geri}`, adımda `catal`); `--kural 2.4.5` 2.4.5 beklentilerini bayt bayt verir,
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
- **Simetri (K-c):** tedarikçinin iade bedelini cari "Tahsilat" ile geri ödemesi alış iadesine bağlanır (geri tahsil edilen kısım borç tarafında ödeme değildir); yalnız 2.4.6'da.
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
- **KS8.3 [BAŞ MİMAR]** iade varken bağsız para ÖNCE iadenin geri ödemesidir; fazlası carinin karşı taraftaki açıklarına (elle Alacak, alış faturası), ondan fazlası avans (K-a). Önceki kâhin
  okuması (iade kalemi elle Alacak ile aynı tarih FIFO'sunda — §9 K-b) bu kararla GEÇERSİZ → mutant 133 artık o okumadır. c8 E'nin beklentisi değişti (fatura 500, Alacak 300 açık).
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
- **c13-ks83-ayni-gun-sira:** aynı gün üç yazım sırası (Alacak/iade/Ödeme; Ödeme/iade/Alacak; iade/Ödeme/Alacak) → hepsinde fatura 500, Alacak 300, bakiye 200; S4 Ödeme iadeden önce → yine geri
  ödeme; S5 müşteriye ciro (K-e).
