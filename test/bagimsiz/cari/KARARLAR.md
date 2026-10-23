# Bağımsız CARİ / EVRAK kâhini — kurallar ve kararlar (2.4.4 madde 31a, B1–B2)

Dil: **`destekofis-cari/2`** (23.10.2026, B3–B5 eklendi; `/1` senaryoları değişmeden koşar) · İlk yazıldığı gün: 22.10.2026 · Kâhin: `model.py` (Python 3, yalnız standart kütüphane, `python3 -I`) ·
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
  Senaryo b3h t4 (Lale Ak güncellenir; Mete Er iki satır: konumu tutan güncellenir, öbürü ikinci kez eklenir + uyarı) ve b3i-devam-ayni-icerik (aynı adlı iki satırdan birinin
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

### B4b — Dört rapor aynı satır borcu (K4 [KULLANICI] 23.10.2026)
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
