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

### B3 — Tablodaki Kişiler BORCU (2.4.4 tur 2: U2 daraltılmış, E2, E3; 23.10.2026)
Kaynak: [KULLANICI] CLAUDE.md Açık iş 22.10 21:34→21:41 UTC (31f (a), 5 dk yetkisiyle) "borç DOSYA NO başına tek kaynaktan (Kalan Borç), aynı dosya no farklı sekmede aynı
kayıt, söz borç değil" + 22.10 ~16:55 UTC B1 kararı "Kalan Borç kalsın; Tablodaki Kişiler de aynı kurala"; [AJAN] ana oturumun verdiği kural metinleri (U2 daraltılmış,
E2 "Kalan hücresi boş satırda … boşsa Toplam", E3 "Kalan Gün gibi gün/adet sütunu borç sayılmaz" — Açık iş 21:14 SORU'da "KARAR GEREKMEYEN düzeltme").
- **B3.1** [KULLANICI] Bir dosya no'nun borcu TEK kaynaktan; aynı dosya no birden çok sekmede bir kez sayılır. Ödeme sözü tutarı borç değildir.
- **B3.2** [AJAN] Sütun önceliği: Kalan/Bakiye → borç/alacak başlıklı sütun → sekmenin TEK tutar sütunu. Tek tutar sütunundan yalnız ödeme sözü (başlıkta "söz",
  "sözü", "taahhüt") borç dışıdır. Aynı öncelikte ilk sekme; yüksek öncelik sonraki sekmede olsa da kazanır.
- **B3.3** [AJAN] Başlığı gün, adet, sayı, ay, yıl, oran, yüzde ya da % olan sütun tutar değildir (E3). [YAYGIN] "Tarih" başlıklı sütun da tutar değildir.
- **B3.4** [KULLANICI] Kalan 0 → borç 0. [AJAN] Kalan boş → Toplam Borç (borç başlıklı sütun; E2).
- Denetim yalnız carisi ve taksit kartı olmayan, taksit sekmesinde bulunmayan kayıtta (bağlı carinin ve kartın borç satırlarının kuralı bu kâhinde yok); kural tanımsız
  sekme (birden çok Kalan ya da borç sütunu; öncelikli sütun olmadan birden çok tutar sütunu) denetlenmez. Etiket: yalnız B3.1 + Kalan sütunu → KULLANICI; öbürü AJAN.
- DENENMEYEN: "Ödendi" söz hiçbir yerde görünmez (söz durum sütunu bu dilde yok), ödeme sözü/vade/zil/Tahsilat Takvimi tutarları (yalnız Tablodaki Kişiler).

### B4 — Nakit Akışı Kasa giriş/çıkış = Kasa raporu (31b MM6; 23.10.2026)
- **B4.1** [KULLANICI] CLAUDE.md Açık iş 22.10 21:21→21:27 UTC "MM6 Nakit Akışı Kasa giriş bütün nakit hareketleri"; ana oturumun kural metni "Nakit Akış'ın Kasa
  giriş/çıkışı Kasa raporuyla aynı toplam: yalnız nakit, bütün kaynaklar". Her kontrolde yıl başından bugüne: Nakit Akışı (cashIn/cashOut) = Kasa raporu (nakit;
  in/out) = kâhinin nakit hareketleri (cari nakit tahsilatı, kayıt tahsilatı, kart tahsilatı, alınan evrakın tahsili); havale (`yol: "havale"`) Kasa'ya girmez.

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
/2 ekleri: sekme türü `serbest {basliklar:[…], kayitlar:[{no, isim, hucreler:{başlık: hücre metni}}]}` (koşucu "Dosya No", "Borçlu" + başlıkları AYNEN yazar);
`tahsilat {…, yol: "havale"}`; `cari_ac {…, tckn}` (gerçek kişi); `nihai_tuketici` (POST /api/workspace/invoices/retail-account); `cari_sil {cari}`;
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
