# Ç5-B — Tek Yükümlülük Kuyruğu (TYK): Kod Tasarım Notu (2.5.0)

Durum: KOD ÖNCESİ (06.11.2026, Ç5-B kod ajanı; xhigh). Taban ba661d1b + eski kâhinler dalı (2aa1e733). Kaynak: `docs/erp/C5-ACILIS-TASARIM.md` §1.4, §1.7, §2.10, §2.12,
§4 13–21, §5, §6, §7, §9 (B1, B12, B13), §10; `docs/2.5.0-IS-LISTESI.md` D (S1, S2, S3, S8, S11, S18, S19, (1)(2)(3)(5), M1a–M1f, M13, S50, S52, S54, S55, S57, S67–S69,
S72, S73, S79–S81, S83–S85; K8-3, K9-1..3, K10-1..3, Y3-1/2); S74–S78 = C (bugünkü davranış). Kâhinlerin kodu bu nota kaynak DEĞİL (yalnız README'leri okundu).

## 1. Modül ve arayüz (`server/lib/obligation-queue.mjs`, saf; veri tabanına dokunmaz)

```
buildObligations(input) → {
  invoices : Map<faturaId, { payable, paid, open, covered, coveredBy, excess, closers[], state, label }>   // FATURA DURUMU (görünüm G2)
  entries  : Map<satırId, { side, remaining, covered }>       // elle Borç / Alacak / açılış / stok / karşılıksız … Kalan (görünüm G1, net)
  items    : AçıkKalem[]                                        // G1 açık kalemleri (şüpheli kuyruğu hariç): { key, kind, side, lineId, invoiceId, planId, itemId,
                                                                //   date (belge), vade, amount, remaining, rank, promise }
  installments : Map<kartId, Map<taksitId, { remaining, paid, byAccount }>>   // G1 taksit kalanı (S50: cari tahsilatıyla kapanan payı byAccount)
  doubtful : { amount, items[] }                                // M13 şüpheli kuyruğu (128; G1'den düşülür)
  overdue(day) → { amount, count, since, items[] }              // gecikmiş(day) = Σ G1 açık BORÇ kalemi (vade < day; M1f), şüpheli hariç
}
input = settleLedger girdisi (lines, invoices, links, chequeEvents, reversals, offsets, today) + { schedules: kartId → taksitler,
        dueDates: satırId → Vade Tarihi, promises: satırId → Beklenen Ödeme Tarihi, doubtfulRecords: [{ date, remainingMinor }], lockAt: (an) → kilit günü }
```
- İKİ GÖRÜNÜM, TEK MOTOR (aynı olay sırası, aynı S2 anahtarı, aynı bağ / kart / karşılıksız / kilit kuralı):
  - **G1 NET (TYK, "gecikmiş" ve listeler):** her CH satırı borç (+) ya da alacak (−) kalemidir; gelen kalem karşı taraftaki AÇIK kalemleri S2 sırasıyla kapatır, artanı
    kendi tarafında açık kalır (iki taraf birden açık değil — EK-1 §4; karar (5) "alış faturası / Alacak Yaz satış borcuna kendi tarihinde"; S68 iki yön).
  - **G2 TARAF (FATURA DURUMU):** `classifyLine` rolleri AYNEN (recvDue / recvPay / payDue / payPay; invoice-settle.mjs:82) — yalnız ödeme rolündeki satır aynı tarafın
    yükümlülüğünü kapatır; karşı yönlü iki fatura birbirini yalnız Mahsup Et ile kapatır (karar (5) son cümlesi; kâhin R5).
- Sıra anahtarı (S2, karar (1), ders 31): olaylar tarih → gün sınıfı (0 borç / yükümlülük, 1 kart açılışı, 2 ödeme / alacak, 3 Kartı Kapat) → kayıt anı → yazım sırası;
  açık kalemler vade ↑ → belge tarihi ↑ → kayıt anı ↑ → yazım sırası ↑. Vadesiz kalemin vadesi belge günü (S1); Ödeme Sözü sırayı değiştirmez (S2 "vade", S52).
- Bağsız ödeme KENDİ tarihinde açık olan kalemlere dağılır; artanı avanstır, sonra doğan kaleme doğduğu gün (avanslar eskiden) uygulanır; kapanmış kalem sonradan doğan
  kalem yüzünden yeniden açılmaz (karar (1)). Bağ (peşin, Kapatılacak Fatura, çek / senet bağı, iade → asıl fatura, iade geri ödemesi, kart tahsilatı, Mahsup Et, POS
  komisyonu) zamandan bağımsız ÖNCE ayrılır (hedefi her durumda kapatır; hedefi önceden kapatmış bağsız ödeme serbest kalır — karar (2)). Bağın hedefi kayıttan sonra
  doğuyorsa son durumda hedef kapanır (S55); aradaki günler ve fazlanın günü bugünkü gibi (S77 = C, S78 = C: fazla ödemenin kendi gününde bağsız).
- Kilit (karar (3), S11, S18, S19): kilit "yazım anındaki kilit" = denetim izindeki son `ledger.period.locked/unlocked` kaydının değeri (kayıt anından önceki; v2.0.26'dan
  beri her kilit değişikliği izde — ledger.mjs:487, ledger-vouchers.mjs:403). B12 göçle damga önerdi; bu ajan göç YAZAMAZ → izden okuma (aynı anlam: kilit sonradan
  ilerlerse karar değişmez). **BAŞ MİMAR KARARI GEREKİYOR (B12-a ↔ iz okuması)**, §8.
  - Karşılıksız: evrak L'de ya da öncesinde alındı, karşılıksız L'den sonra yazıldıysa (L = karşılıksızın yazıldığı andaki kilit) netleştirme YOK: alış satırı kapattığını
    kapatmış kalır, karşılıksız TAM tutar ayrı borç kalemi (vade = karşılıksız günü). Değilse UX18 aynen (S8: kapattığı kalemler kendi vadeleriyle açılır).
  - Bağ: hedefin L'ye kadar bağsız kapanmış kısmı açılmaz; bağın o kısmı bağsız gibi dağılır; kapatanlarda "Kilitli dönemde kapandı" notu (S11 sunumu).
- Kartlar (M1e, S50, K8-3): kendi kartı olan fatura → fatura kalemi (tutar − kart) + kartın taksitleri; "Carinin Mevcut Borcu" kartı açıldığı an açık borç kalemlerini
  S2 sırasıyla kart tutarı kadar TÜKETİR (bugün en yeniden → DEĞİŞİR); ayrı kart (Yeni Borç / Excel / Tablodan Aktar) kendi borç satırını tüketir. Kuyrukta yalnız taksitler;
  taksit toplamı tüketilenden büyükse son taksitlerden kırpılır, küçükse kalan tek kalem (vade = kart günü). Kart tahsilatı / iadesi / Kartı Kapat kalanı kartın bağıdır
  (vadesi ilk gelen açık taksitten); kart seçilmeden alınan tahsilat taksitleri de S2 sırasıyla kapatır (S50, K8-3: vadesi gelmemiş taksit de).
- Şüpheli (M13; yalnız G1): açık şüpheli kaydın kalanı, kayıt gününe kadar doğmuş açık borç kalemlerinden S2 sırasıyla şüpheli kuyruğuna alınır (gecikmişe ve listelere
  girmez); kayıt kapanınca kalemler kendi vadeleriyle döner. 120 ↔ 128 defter ayrımı Ç5-A (§2.11) — burada yalnız kalem görünümü.

## 2. Bugünkü üç kaynak ve dağıtımın TYK'ya geçişi (dosya:satır, taban)
| Bugün | Ç5-B |
|---|---|
| `lib/invoice-settle.mjs` settleLedger (en eski belge, havuz; ayrı kart kendi defteri :24–27, :209, :355; Mevcut Borç en yeniden :544; planned atlanır :517) | YAZMA YOLLARI için AYNEN kalır (kart / bağ defteri: `coverState` invoices.mjs:2027, `ownTarget` :2047, `repairScreen` :2109, `config.legacyClosing`) — kart tutarını / iade küçültmesini değiştirmesin (defter kuralı değişmez; karar (4) Ç7b) |
| `routes/invoices.mjs` allSettled :741, accountSettleInput :764, paymentStates :786, entryStates :816, openItems :5070, dueItems :5080 | girdi aynı + taksit takvimleri, vade / söz, şüpheli kayıtları, kilit izi → `buildObligations`; paymentStates = G2, entryStates = G1, openItems(net) = G1, openItems() = G2 |
| `routes/accounts.mjs` openDueItems :1800 (yalnız vadeli / sözlü elle satır), dueItems :1847, detail :151, list :265, waFacts :212 | openDueItems = G1 fatura ve taksit DIŞI bütün açık kalemler (vadesiz elle borç, açılış, stok, karşılıksız dahil — S1; §2.10 "aynı borç bir kez"); detail / list yeni alanlar (§3) |
| `routes/plans.mjs` dueItems :1306, openItems :1351 (kartın kendi `allocate`'i) | cariye bağlı kartta taksit kalanı G1'den (S50); carisiz eski kartta `allocate` aynen |
| `routes/dues.mjs` :47–108 (üç kaynak birleşik) | kaynaklar aynı uçlar; tutarlar G1'den (aynı borç bir kez) |

## 3. KULLANAN YOLLAR (kaynak taramasıyla: `grep -rn "overdue\|openItems\|dueItems\|paymentStates\|entryStates" server client`)
1. Cari kartı: `totals.overdueDebt` / `overdueDebtCount` / `overdueSince` (TYK) — ekranda "Gecikmiş Borç" (kalem sayısı); `totals.overdue` ESKİ anlamda (taksit) KALIR (§8 B1-W).
2. Cari listesi: satır `overdue` / `overdueCount` = TYK; süzgeç `balance=overdue` "Gecikmiş Borcu Olan", sıralama "Gecikmiş Borç"; toplam `totals.overdue` TYK.
3. Anlık Durum (overview.mjs:165 list totals) — liste toplamından, TYK. Cari Mizanı süzgeci (overview.mjs:263, :278 ad) TYK.
4. Mobil özet `side=overdue` (lib/mobile.mjs:31 → list süzgeci) — TYK (kendiliğinden).
5. Vade Takip / Nakit Akışı / Projeksiyon (overview.mjs:359–413, :632–641; report-center.mjs:1865–1874 okur) — plans / invoices(net) / accounts openItems, TYK.
6. Zil / Tahsilat Takvimi (dues.mjs) — aynı uçların dueItems'i; parmak izi §5.
7. Fatura listesi / kartı / Açık Faturalar raporu (invoices.mjs list :1336, detail :1114; report-center.mjs:2224 okur) — G2 durum, Kalan, "Vadesi Geçti", Kapatanlar;
   CLOSER_MODES "Otomatik (vadesi en önce gelen)".
8. Cari kartı elle borç "Kalan", Kapatılacak Fatura önerisi (mahsup adayları offsetCandidates :3596) — G1 Kalan / G2 açık.
9. Cari ekstresi PDF / Excel, Cari Listesi PDF / Excel (accounts.mjs:1180, :1216, :1248) — "Gecikmiş Borç" TYK.
10. Taksit kartı ekranı (plans detail / list) — G1 taksit kalanı + "Cari tahsilatıyla kapandı" payı.
11. WhatsApp (queue.mjs:146 `totals.overdue`, whatsapp.mjs:138) — DOKUNULMAZ; eski alan korunur (Ç5-C).
12. Mutabakat kapısının `list({ ids })` çağrısı (ledger.mjs:252, integrity-scope.mjs:517, integrity.mjs:340) — TYK HESAPLAMAZ (`withOverdue: false`; §6).
13. Devir (D4) — ileride `items` ile (M2).

## 4. Düzeltme reddi (cari değişimi) — `routes/accounts.mjs` PUT entries (:1057)
Bugün PUT `accountId`'yi yok sayıyor (BAŞ MİMAR 12:09). Yeni gövde alanı `accountId` (yalnız kaynağı boş satır; tahsilat / ödeme / borç / alacak). Sıra K10-1:
KILITLI_DONEM (eski ve yeni tarih, 409 period-locked) → KASA_ACILIS_ONCE (Ç5-K'nın; bu dalda YOK, §8) → FATURA_DUZENLENMELI (S80 / S83 / S84: kaynağı fatura olan peşinin
carisi ya da bağı → 409 `invoice-payment-edit` "faturayı düzenleyin") → BAG_KALDIRILMALI (S57: cari değişiyor, bağ (invoice_id / refund_of) aynı ve dolu → 409
`entry-link-first` "önce bağı kaldırın") → SUPHELI_NORMAL_ASIM (S81 / S85 / S56: yeni hâl 120'ye yazıyor, kaydın YENİ gününde şüpheli dışı bakiye aşılıyor → 409
doubtful-normal-exceeds; K10-2, K10-3). S54 / S79: cari + bağ aynı düzeltmede → kabul, bağ yeni carinin belgesine (invoiceLink yeni cariyle) ya da boş. Para çekirdeği:
`bank.post` aynı (op update); iki cari de "dokunulan"; Kasa tutarı değişmez.

## 5. Önbellek ve bayatlık (§10 "ilk adım")
- Tek cari (kart / fatura kartı): her istekte hesaplanır (saf işlev; ölçüm §6).
- Bütün cariler: `allSettled` önbelleği genişler — anahtar `total_changes | data_version | gün` (bugünkü settleKey) DEĞİŞİNCE cari başına parmak izi (cari satırı sayısı / son
  rowid / son güncelleme / tutar toplamı; fatura, kart + kart hareketi + taksit, çek olayı, mahsup, şüpheli kaydı aynı biçimde; GROUP BY sorguları) okunur, YALNIZ izi
  değişen carilerin kuyruğu yeniden kurulur ("yazımdan sonra yalnız dokunulan cari"). Gün dönünce kuyruk değişmez, yalnız overdue(day) yeniden okunur.
- Zil / takvim (dues.mjs `key`): plans / invoices / accounts parmak izlerine kart taksitleri ve şüpheli kayıtları eklenir (G1 kalemleri bunlara bağlı); kilit izi eklenmez
  (karar yazım anındaki kilitle verilir, S19 — kilit sonradan değişince sonuç değişmez).
- İşlem içinde (store.inTransaction) önbellek ne okunur ne yazılır (bugünkü kural).

## 6. Ölçüm planı (ders 47, 52; §6 bütçesi)
Veri: `scratchpad/c5t-olcum/n-100000`'in YENİ kopyası (`scratchpad/c5b-olcum/`); aynı kopya önce (ba661d1b ayrı kopya) / sonra (bu dal); `flock -x scratchpad/olcum.lock`;
/proc/loadavg yazılır (yük > 2 → geçersiz). Yollar: tek cari (en kalabalık), cari listesi soğuk + ılık, Anlık Durum, Vade Takip, zil, fatura listesi, yazımdan sonra liste,
elle toplu WhatsApp alıcıları (2.000 cari; WhatsApp koduna dokunmadan, yalnız okuma). Bütçe: tek cari ≤ +20 ms; soğuk bütün cariler ≤ 2 sn ve olay döngüsü ≤ 50 ms
(ana iş parçacığı dışı) — iş parçacığı bu turda yapılmazsa BİLİNEN SINIR olarak sayılarıyla yazılır; yazımdan sonra yalnız dokunulan cari ≤ 20 ms; kapının list()'i değişmez.

## 7. "Nasıl bozulur?" (C5 §4 13–21 + ekler; testler buradan)
13. S2 / (1): bağsız ödeme vadesi önce gelene; ödemeden sonra doğan borç; aynı gün borç + ödeme; giriş sırası ↔ belge tarihi ters (anahtarlar ters çevrilerek).
14. Bağ sonradan ((2)): Kapatılacak Fatura / Mahsup Et / iade, hedef önceden bağsız kapanmış; kilitli dönemde ((3)).
15. Karşılıksız: kilit öncesi / sonrası alınmış, kilit öncesi / sonrası karşılıksız (S8, S11, S18 avans, S19 kilit sonradan ilerler); ciro dönüşü (tedarikçi).
16. Taksit: fatura kartı, Mevcut Borç kartı (kısmi, S2 sırası), Yeni Borç / Excel kartı; cari tahsilatı ayrı kartın taksitine düşer (S50); vadesi gelmemiş taksit (K8-3).
17. Netleşme: aynı kişi müşteri + tedarikçi; alış > satış (alacaklı → gecikmiş 0); Mahsup Et; fatura durumu alış faturasıyla değişmez.
18. Vadesiz fatura / Borç Yaz / açılış ertesi gün gecikmiş; vade günü değil; Ödeme Sözü (S52, S67, S69, Y3-1, S72, S73).
19. Şüpheli: kuyruk, çıkış, şüpheli + şüphesiz gecikmiş.
20. Bütün ekranlar aynı sayı: cari kartı = liste = Anlık Durum = mobil = Vade Takip (cari toplamı) = fatura durumu; iki kullanıcı aynı anda (önbellek bayatlığı).
21. Güncelleme anında kuyruktaki Ödeme Hatırlatma işi — Ç5-C (WhatsApp eski alanı okur; değişmez).
Ekler: 22 iki saat dilimi + gece yarısı (bugün = yerel gün, config.now); 23 ay sonu / 31.12 vadesi; 24 aynı adlı iki cari; 25 iki şirket (önbellek şirket başına); 26 yedekten
geri yükleme / v2.4.9 gerçek koduyla üretilmiş veri (ders 17); 27 ileri tarihli tahsilat (son durumla hesaplanır — bugünkü bakiye gibi; §8); 28 kart silinir / Silinenler'den
döner; 29 düzeltmede cari değişimi (S54, S57, S79, S80, S81, S83–S85), red sırası; 30 kapının list()'i TYK hesaplamaz (yavaşlamaz).

## 8. Açık seçimler (kodlanmadan önce yazıldı; rapor bunları ayrıca listeler)
- **B1-W (BAŞ MİMAR KARARI GEREKİYOR):** görev metni "Ç5-B totals.overdue'nun anlamını değiştirir, WhatsApp overdueInstallments'ı okur" der; ama WhatsApp (dokunulmaz) bugün
  `totals.overdue`'yu okuyor (queue.mjs:146). WhatsApp'ın davranışı Ç5-C'ye kadar değişmesin diye cari kartı / waFacts'te `totals.overdue` ESKİ kalır, TYK yeni alanlarda
  (`overdueDebt*`). Ç5-C WhatsApp'ı yeni alana geçirir. Cari listesi satırının `overdue`'su TYK (WhatsApp listeyi yalnız süzgeç için çağırır — "Gecikmiş Borcu Olan" süzgeciyle
  toplu gönderimde aday küme TYK, eleme eski alan: güvenli yön).
- **B12 iz okuması (BAŞ MİMAR KARARI GEREKİYOR):** §1 kilit maddesi.
- **İleri tarihli kayıt:** kuyruk bütün kayıtlarla (bugünkü bakiye gibi) — ileri tarihli tahsilat bugünkü gecikmişi düşürür (BİLİNEN SINIR adayı; karar metni "kendi tarihinde").
- **Ödeme Sözü cari düzeyi:** program sözü kalem (elle borç satırı) düzeyinde tutar; carinin sözü = açık (G1 kalanı > 0) kalemlerin en geç Beklenen Ödeme Tarihi (bugün ve sonrası)
  — "Ödeme Sözü Var" görünümü (S72 söz günü dahil, S73 bütün borç, K9-2). BAŞ MİMAR değerlendirir.
- **Takvim günü (S67, S69, Y3-1):** vade geçmişse durum "Gecikmiş", gün sayısı min(söz, vade)'den (söz ≥ vade → vadeden; söz < vade → sözden); vade geçmemişse K6.3 aynen
  (gün sayısı sözden). Uç: söz geçmiş, vade geçmemiş → takvimde K6.3 "Gecikmiş" ama gecikmiş tutarında yok — KULLANICIYA SORULMALI (uç).
- **İade → kapsayan kartın küçülmesi** (coverState) eski kapsam sırasıyla (en yeni borç) kalır — karar (4) Ç7b ile TYK'ya geçer (BİLİNEN SINIR).
- **G2'de K-b (bağsız paranın karşı tarafın açık iadesini kapatması, 2.4.6):** son geçişte açık iade kalanları karşı tarafın serbest parasıyla (eskiden) kapanır — 2.4.6'nın
  "tek sıra" ayrıntısı yaklaşık; cari kâhini KS8 senaryolarıyla denetlenir.

## 9. Kodlama sırasında netleşenler (06.11.2026 akşam; komşu testleri ve fark incelemesinden — karar metinleri değişmedi, YORUMLAR rapora da yazıldı)
- **Kart kapsamına giren borç** (v2.0.23 kuralı AYNEN): Mevcut Borç kartı yalnız kendisinden ÖNCE KAYDEDİLMİŞ (fatura: issued_at; öbürleri satırın kaydı) açık borcu
  tüketir; karttan sonra yazılan (aynı gün ya da geriye tarihli) borç kapsanmaz. Kart açılışı gün içinde ÖDEME sınıfında kayıt anıyla sıralanır (taksitleri hemen
  ardından): karttan önce yazılan aynı gün ödeme önce kapatır (bulgu-223 "3. tur"). Kartın anında bilinmeyen satırlar (sonradan yazılan karşılıksız, geriye tarihli
  ödeme) kartın NEYİ tükettiğini değiştirmez: kartın anına kadar kaydedilmiş satırlarla bir ön geçiş oynatılır, kart asıl geçişte o kalemleri tüketir (`coverForcing`;
  UX18 T17 (i) — portföydeki evrak sonradan karşılıksız dönünce yeniden açılan fatura kartın dışında). Ön geçişte tükettiği kalem asıl geçişte kapanmışsa o pay son
  taksitlerden düşülür (EK-2B 32 yolu). 2.5.0 kararları yalnız tüketim SIRASINI değiştirdi (S2).
- **Artımlı önbellek güvenliği:** cari izi damgaya ek olarak tarih ve bağ kolonlarını toplar (gün sayısı toplamı; kimliğin uzunluğu + son iki karakteri); yazım olduğu
  hâlde hiçbir carinin izi değişmediyse (durağan / geri giden saatte aynı anlı bağ değişimi gibi) bütün cariler yeniden kurulur; dönem kilidinin izi değişince de.
  Kalan teorik açık: aynı okuma aralığında bir caride izde görünmeyen değişiklik + başka bir caride görünen değişiklik + saatin ilerlememesi + kimliğin son iki
  karakterinin aynı olması (BİLİNEN SINIR; gün dönünce bütün cariler yeniden kurulur).
- **Rapor Merkezi eski anlamda kalır (report-center satırı sonra, C5-ACILIS §0):** Rapor Merkezi'nin "Cari Listesi ve Bakiyeler" (Geciken kolonu, "geciken taksit"
  açıklaması), Cari Mizanı "Geciken Taksiti Olan" süzgeci (report-center.mjs SIDE_FILTER + hof-report-center.js; ikisi de bu işin dosyası değil) taksit anlamını
  gösterir: cari listesi kimliksiz iç çağırana (Rapor Merkezi, projeksiyonun bakiye okuması) TYK hesaplamaz; Anlık Durum `withOverdue: true` verir. Ad ve anlam
  birlikte değişsin diye — ana oturum / Ç3: report-center'da "Gecikmiş Borç" adına geçince kimliksiz çağırana `withOverdue: true` verilir.
- **Küçültülmüş Mevcut Borç kartı:** kapsam tutarı (coverTotal) kartın açıldığı andaki tutardır; kart sonradan küçültülmüşse (iade → coverState, Tutarı Düzenle) TYK
  taksitleri bugünkü taksit toplamıyla sınırlar (eksik kısım "kalan tek kalem" olarak geri eklenmez — iade-210 K: kart 250, Vade Takip 250).
- **Cari kartının taksit özeti eski hesapta kalır (BİRLEŞİM KURALI):** cari kartının `plans` özeti (WhatsApp plan() okuması) kartın kendi hesabıdır; Taksitler ekranı
  (GET /plans/:id) kuyruk kalanını / durumunu gösterir — iki görünüm Ç5-C'de birleşir (BİLİNEN SINIR, Ç5-C işi).
- **config.legacyClosing (yalnız testler, 2.0.26 ile birebir karşılaştırma):** TYK görünümleri kapalı (allObligations null) — liste, taksit, cari kalemi eski yollarıyla.
  K1 sınırı (göç zinciri, altın test) kapama DEFTERİ kuralında (repairScreen, invoice-settle.mjs) denetlenir; ekran durumu TYK görünümüdür.
- **Gecikmiş = Σ açık BORÇ kalemi (EK-1 §1 madde 1 ve 5):** net kuyrukta her CH hareketi kalemdir; netleşmemiş borç yönlü bağsız ödeme (müşteriye para iadesi T-09,
  tedarikçiye avans) da açık borç kalemidir, vadesi kendi günü (S1) — gecikmişte ve takvim / zil / Vade Takip'te ("Tahsil Edilecek Borç"; cari kartı satırı olmayan çek /
  senet satırı takvim kalemi olmaz — BİLİNEN SINIR). Karşı yön (alınan avans) kalem değildir (bugünkü gibi). Önce "yalnız yükümlülük rolü" denendi; cari kâhininin c13
  senaryosunda (aynı gün elle Alacak + stok iadesi + müşteriye Ödeme) vadesi geçmiş 200 gecikmişten kayboluyordu → EK-1 metnine dönüldü. KULLANICIYA SORULMALI (tedarikçiye
  avans "Gecikmiş Borç" sayılsın mı).
- **Karar (5) okuması:** net kuyruk (Kalan, takvim, zil, Vade Takip, gecikmiş) karşı yönlü kalemleri kendi tarihinde netleştirir (C5-ACILIS §2.10 madde 7, EK-2 S9 A
  "gecikmiş 4.000"); fatura durumu iki yönlü kalır. Cari kâhini (KARARLAR §13 madde 9 + C13.5) Kalan / takvimi iki taraf ayrı, gecikmişi min(bakiye, Σ vadesi geçmiş)
  hesaplar — S9 örneğinde 9.000 (= S9 B). Fark kâhin bakımına (kâhin şüphesi) — ana oturum / kâhin 11 değerlendirir.
- **Şüpheli kuyruğu (M13) vade kalemi değildir:** zil / takvim / Vade Takip (cari, fatura, taksit kalemleri) şüpheli kısmı düşer; Vade Takip'teki "Şüpheli Alacak (vade
  takibinin dışında)" satırı aynen (2.4.5 KS7 testindeki "şüpheliye alma: takvimde kalemler sürer" M13 ile değişti). Kalem ÖDENMİŞ sayılmaz: Kalan ve fatura açığı sürer.
  Nakit akışı ve Alacak Yaşlandırma ("Şüpheli Alacak (dilimlere dahil)") bugünkü gibi bütün kalanı okur. Fatura durumu "Şüpheli Alacakta" etiketi (C5-ACILIS §2.10
  madde 8) bu turda YOK (Ç5-A ile, 120 ↔ 128).
- **S1'in görünür sonucu:** vadesiz elle Borç / Alacak, açılış, stok veresiye ve karşılıksız evrak takvim / zil / Vade Takip kalemidir (kayıt gününde vadeli; ertesi gün
  "Gecikmiş"); nakit akışında "Faturasız Cari Alacağı" satırının bu kısmı cari kalemi olarak ("Tahsil Edilecek Borç") görünür — tutar aynı, kaynak adı değişir. Borç
  yönü de simetriktir (S68): vadesiz elle Alacak / tedarikçi borcu "Ödenecek Borç" kalemidir (bugünkü vadesiz alış faturası gibi). Gerekçe: EK-1 §1 değişmez (iii)
  "Vade Takip gecikmiş tutarı = gecikmiş" ve C5-ACILIS §4 madde 20. Cari kâhini K6.3'ü AYNEN tutar (yalnız Vade / Beklenen tarihli kayıt kalem) — fark kâhin bakımına;
  zilde vadesiz her Borç Yaz ertesi gün "Tahsilat alınmadı" olur → KULLANICIYA SORULMALI (A: kalem — kodlanan / B: 2.4.5 K6.3 aynen, vadesiz yalnız gecikmişte).
- **Kapatan adı:** CLOSER_MODES.auto "Otomatik (vadesi en önce gelen)" (C5-ACILIS §2.10 madde 3). Rapor Merkezi "Fatura ve Banka Hareketleri"nin kendi bağ türü adı
  (report-center.mjs:1425 "Otomatik (En Eski)") ve çek formundaki "Otomatik (En Eski Açık Fatura)" (hof-cheques.js:325) bu işin dosyaları değil — ana oturuma.

## 10. Tur 2a (10.11.2026; dar kontrol DK-C5B'nin YÜKSEK / ORTA bulguları — S101 ve S95–S99 hariç, onlar tur 2b)
- **Y-1 (Kayıt Tarihi borçtan önce olan Mevcut Borç kartı):** kart, Kayıt Tarihi'nde kapasitesini dolduramıyor VE kartın anında bilinen, Kayıt Tarihi'nden sonra tarihli borç satırı
  varsa (`lateCovers`) ön geçişte BİLİNEN SATIRLARIN SONUNDA açılır (v2.4.9'da kapsam bilinen satırların son durumuydu); asıl geçişte açılış günü (ve taksitlerin doğduğu gün)
  Kayıt Tarihi ile tükettiği kalemlerin en geç doğduğu günün büyüğüdür. Hesapta (göçsüz; eski verideki kartlar kendiliğinden düzelir). Kayıt Tarihi'nde kapasitesini dolduran
  kartın davranışı değişmez. Kayıt yolu (stoktan taksitlendir / toplu taksitlendirme kartın Kayıt Tarihi'ne carinin Kayıt Tarihi'ni yazıyor — v2.0.12) DEĞİŞMEDİ.
  **KULLANICI KARARI BEKLİYOR:** kartın anında açık borç kart tutarından fazlaysa HANGİ borç tükenir — S2 sırası (bu notun §9'u) ↔ kartın kendi (en son kaydedilen) borcu
  (v2.4.9; test/bulgu-223 #4). İki okuma farklı kalem seçiyorsa (`ambiguous`) kart kaydırılmaz (bugünkü davranış), karar gelince tek satırda değişir.
  Durağan saatte (bütün damgalar eşit) "karttan sonra yazılan" ayırt edilemez — eşit damga "bilinen" sayılır (v2.0.23'ten beri; BİLİNEN SINIR, ders 31).
- **Y-3 (önbellek):** iz (`accountPrints`) kuyruğun okuduğu bütün kolonları satır kimliğiyle karışık asal modül özetle kapsar; hiçbir carinin izi değişmediyse önbellek korunur
  (önceden bütün cariler baştan kuruluyordu). Kilit izi SQL'e NUL'lu kimlikle bağlandığı için HİÇ yazılmıyordu (yaşayan mutant N09'un nedeni) — JS'te anahtarlanır. Eşdeğerlik:
  test/tyk-onbellek-250.test.mjs. Kök şirketin yedekten geri yüklemesi yeniden açılışta uygulanır (yeni süreç, boş önbellek); öbür şirket yeni örnekle açılır.
- **O-1 (karar (3) × düzeltme):** bağın anı = bağı değiştiren son düzeltmenin denetim izindeki anı (account.entry.updated önceki ↔ yeni invoiceId; plan.entry.updated önceki ↔ yeni
  itemId), yoksa kaydın anı (`linkTimesOf`, `linkedAt`). Tutar / tarih düzeltmesi bağın anını değiştirmez (bağ aynı) — tutar büyütmesi KULLANICIYA SORULMALI listesinde.
- **"Hangi Taksite" bağı (O-2'nin kök nedeni):** bağlı kart tahsilatı önce KENDİ taksitini kapatır (karar (2); lib/plans.mjs allocate ile aynı sıra), artanı vade sırasıyla;
  kilitli dönemde bağsız kapanmış taksiti yeniden açmaz (bağlı tahsilat varken kartın kilitli dönemdeki bütün taksitleri ölçüme yazılır). Kartın tahsilat havuzu eksiye
  düşerse (iade ya da karşılıksız çekin ters kaydı bağlı tahsilattan çok) bağlı paylar EN YENİ taksitten geriye geri alınır (allocate kural 3); kalan eksi Taksit İadesi
  kalemidir (komşu test/cheques-overview "karşılıksız çek taksiti yeniden açar" bu kuralın ilk hâlinde kırmızıydı). Eşdeğerlik: tyk-250 "kuyruğun taksit kalanları = kartın
  kendi hesabı (allocate)", yalnız kart hareketli rastgele kartlarda.
- **O-2:** taksit kartının bütün yazım yanıtları (açma, düzenleme / durum, Otomatik Dağıt, taksit ekle / düzelt / sil, tahsilat / iade ekle / düzelt / sil) okumayla aynı
  görünümü (detailView) işlem kesinleştikten sonra döndürür.
- **O-3 (S91 = A):** kuyruğun taksit olmayan kart kalemleri — taksitlere bölünmemiş kalan (`rest`, "Taksitlendirilmemiş Kalan", vade kartın açılış günü) ve Taksit İadesi (`back`,
  vade son İADENİN günü) — takvim / zil / Vade Takip / nakit akışı kalemidir (routes/plans.mjs queueExtras); kartın durumu ve taksit gecikmişi taksitlerden (değişmedi).
- **Değişmez:** "Σ kalem = cari bakiyesi" kartlı rastgele carilerde (tyk-250 tur 2a); S101 (kart kırpıldı + kart tahsilatı) ve S99 adıyla dışarıda, sayıları çıktıda. Tanı alanı
  `coverage` (kart başına tükettiği ↔ tüketebileceği).

## 11. Tur 2b-1 (11.11.2026; dar kontrol DK-C5BT2A'nın ORTA / DÜŞÜK bulguları — S95–S99, S101–S105, S110'un kodu tur 2b-2)
- **G-2 (kart durumu; beklenen v2.4.9'un gerçek kodu):** Bitti için kuyruk kalanı 0 + bütün taksitler ödendi YETMEZ; ayrıca kart tutarı > 0 ve (kartın KENDİ kalanı 0 — v2.4.9
  `allocate` kuralı — YA DA taksiti olup Mevcut Borç kartında taksitlere bölünmemiş kapsam kalmamış). Neden: taksitsiz kartta boş listede "hepsi ödendi" doğruydu; Mevcut Borç
  kartında taksitlere bölünmemiş borç kuyrukta kartın değil alttaki borç kalemidir (coverTotal = taksitler, v2.0.23). S50 = A'nın kapattığı taksitler (kart seçilmeden alınan
  tahsilat) bugünkü gibi Bitti'ye götürür; Mevcut Borç kartında taksitlendirilmemiş kısım kalırken Aktif kalır (v2.4.9: Gecikti — fark testi S50).
- **ORTA-1 (karar (3) × çek / senet düzeltmesi):** bağ ilk olaydadır (cheque_events.invoice_id); bağın anı = `cheque.updated` izinde `invoiceId` taşıyan son düzeltmenin anı, yoksa
  ilk olayın kaydı (routes/invoices.mjs `chequeLinkMoments`). KESİN an (`linkMoments`, kuyrukta `linkedAt`'ten önce): tutar / cari / tarih düzeltmesi olayın satırlarını yeniden
  yazar (yeni kayıt anı) ama bağ aynıdır — cari tahsilatının "tutar / tarih düzeltmesi bağın anını değiştirmez" kuralı. Çekin karta sayılması (plan_entries) eski kuralda (satırın
  kaydı; izde planId değişimi yok — BİLİNEN SINIR). Bağın KALDIRILMASI: ödeme bağsızdır (çek = cari tahsilatı); kilitli dönemdeki bağsız kapanışların bundan etkilenmesi
  KULLANICIYA SORULDU listesinde (tur 2b-1 raporu).
- **ORTA-2 (S91 = A, S93, S96):** cari kalemleri (Vade Takip / zil / takvim / nakit akışı) alacak tarafındaki HER açık kalemdir (fatura ve kart kalemleri kendi kaynaklarında):
  tedarikçideki faturasız (stoktan) ve faturalı Alış İadesi artık "Tahsil Edilecek Borç". Çek / senet ve banka (POS) kaynaklı verilen avans S96 notuyla tur 2b-2.
- **G-1 (hız, en küçük düzeltme):** kart ekranı (GET /plans/:id) ve bütün kart yazım yanıtları kuyruğu YALNIZ kartın carisi için kurar (`invoices.obligationsFor` — önbelleğin
  artımlı yolunun cari başına kullandığı işlev; §5 "tek cari her istekte"). Taksitler listesi, zil, Vade Takip bütün carilerin kuyruğunu okumayı sürdürür. Eşdeğerlik:
  test/tyk-tur2b1-250 (yanıt = okuma = liste satırı, cariler arası durumlar).
- **K8 formu (karar 'CI #1059' (2)) KODLANMADI:** sunucunun K8 sınırını kuyruk kalanına çevirmek mutabakat motorunun K8 modelini (test/mutabakat/motor.mjs planLeft = kartın
  kendi kalanı; plan §3.10/3) kırıyor (mutabakat-cekirdek / yıl dönümü: "taksit-tahsil: yanlış ret 409 plan-paid") ve taksitli faturada önceki avans kartı "ödendi" sayıp
  faturanın açığını (G2) kart tahsilatıyla kapatmayı engelliyor → para kuralı ayrışması (ders 43), KULLANICIYA SORULMALI; senaryo-k8-230 kırmızı kalır.
- **Fark testi (ders 53, kalıcı):** test/fixtures/tyk-fark-v249 (v2.4.9'un gerçek koduyla üretilmiş 28 sınıf + v2.4.9'un kendi sayıları) → test/tyk-fark-v249-250; her fark
  `beklenen-farklar.json`'da karar numarasıyla. Değişmez (tyk-250): S110 sınıfı `coverage.ambiguous` ile ayrı adla; S99 dışlaması kalktı.

## 12. Tur 2b-2 (11.11.2026; kullanıcı kararları S95–S99, S101–S105, S110, S118, S120, S122 + ekran yürüyüşü 1'in Y2 / Y4) — KOD ÖNCESİ
Kaynak: iş listesi C / D AYNEN (13:20, 13:27, 18:22, 18:28; 11.11 03:15, 06:14, 06:35, 07:33); cari kâhininin KARARLAR §17–§21 YORUMLARI (Y5-1 … Y9-9; kodu değil). Satır numaraları taban
c5b-2b2-taban (ba77c90b). Bugünkü sayılar ajan betiğiyle (DK-C5BT2A s95-98 / s99-105 / kart-avans kopyaları; sahte saat 20.10.2026) yeniden üretildi.

### 12.1 Karar → değişen kural (dosya:satır) → örneğin bugünkü / hedef sayısı
| Karar | Değişen kural | Bugün (taban) | Hedef (karar metni) |
|---|---|---|---|
| S95 = A (+ S97, S102) | obligation-queue.mjs `arrive` :640–658 (NET): bağsız ödeme (tahsilat / Ödeme / faturasız stok iadesi / kart fazlası) önce açık karşı kalemleri kapatır; artarsa ÖNCEKİ GÜNLERDE iki YÜKÜMLÜLÜK kalemi arasında yapılmış netleşmeyi EN YENİDEN geri alır (karşı kalem yeniden açılır, ödeme kendi tarafının kalemini kapatır); kendi günündeki netleşme kesin (S97). | satış 10.000 (vade +10) · alış 6.000 · biz 6.000 öderiz: gecikmiş 6.000, Vade Takip 'Tahsil Edilecek Borç 6.000' + fatura 4.000 | alış Ödendi, satış 10.000 vade +10, gecikmiş 0 |
| S97 = A | eventOrder :77–82 (gün → sınıf 0 kalem / 2 ödeme) — DEĞİŞMEZ; geri alma yalnız `closure.date < ödemenin günü` | Alacak 0 + avans 300 | aynı |
| S102 = A | aynı geri alma, en yeni önce (K2) | X 0, Y 0, Σ −600 (avans 600) | X 300 açık, Y 0, avans 300 |
| S103 = A | verilen avans ↔ alış kapanışı netleşme DEĞİL (ödeme ↔ kalem) → geri alınmaz | alış Ödendi, avans 300 kalem değil | aynı (geri alma kuralı bozmamalı) |
| S98 / S104 = A | s2 :70–75 avans dahil tek vade sırası — DEĞİŞMEZ | avans 50 + Borç 100 / avans 200 + Alacak 200 | aynı |
| S105 = A | `arrive` :643: gelen alacak yönlü YÜKÜMLÜLÜK kalemi (alış, Alacak, alacaklı Açılış) önce açık alış iadesi alacağını (stoktan Alış İadesi, faturalı Alış İadesi) kapatır, sonra s2 | iade 200 açık + avans 50 (zil iki kalem) | iade 0, avans 250 |
| S96 = A (+ S93) | routes/accounts.mjs :1893 `RECEIVABLE_ITEM_ORIGINS` + çek / senet (`cheque`) ve banka (`pos-fee`) kaynaklı açık borç yönlü kalem → 'Tahsil Edilecek Borç' (Vade Takip / zil / takvim / nakit akışı) | tedarikçiye verilen çek: gecikmişte var, takvimde yok | her ekranda aynı tutar |
| S99 = A | obligation-queue.mjs `assemble` :723–737 (G2): taksitli faturanın açığı = kendi kartının taksitlerinin + peşin kısmının KUYRUK kalanı (bağsız kapanış dahil; `linkedLeft` kalkar); kapatanlarda Otomatik satırlar; `runQueue` :225 kilit ölçümündeki "side + ownCard" istisnası kalkar (G1 ile aynı kural); mutabakat motoru test/mutabakat/motor.mjs :429 (fatura açığı = kartın kendi kalanı) en küçük hâliyle güncellenir | B 300 Gecikti + A 300 Gecikti (Σ 600 ≠ bakiye 300) | B Ödendi, A 300 açık, Σ = 300 |
| S101 = A (genel mekanizma) | `coverEvent` :630–638 (EK-2B 32 kırpma) → kartın taşıdığı borcun BAĞSIZ PARAYLA (tahsilat, alınan evrak, kart fazlası) kapanmış kısmı kartın ÖDENMİŞ kısmıdır (vadesi en önce gelen taksitten); yalnız kalanı (para dışı kapanış: iade, Alacak …) son taksitten kırpılır. Ön ödeme kart tahsilatından ÖNCE yazılsın diye `runQueue`'da kararlı olana dek (en çok 3) ek geçiş; kart tahsilatı açık taksit bulamazsa carinin avansıdır (mevcut `card-excess`). `coveredLeftOf` :675 ön ödemeyi elle kaydın Kalan'ından düşmez. | kart Bitti, gecikmiş 100, Σ kalem 100 ≠ bakiye −200 | kart Bitti, takvim / zil boş, gecikmiş 0, Σ = −200 |
| S110 = A | `coverEvent` :618–626 + `coverForcing` :182–185 (ambiguous kolu kalkar) + `endCover` :596–612: kartın anında açık borç O > kart tutarı T ise kart KENDİ borcunu taşır — satışla açılan kart: kartın anına kadar en son kaydedilen borç satırı tutarı karta eşit stok satışıysa o; elle kart: açık tutarı T'ye eşit TEK elle borç (Borç Yaz / borçlu Açılış) varsa o. lib/accounts.mjs :99 kart satırına `coverSource` (Excel / Tablodan Aktar kartı `import_id` ile — S110 / S120'ye GİRMEZ) | elle 900 + F 600, kart 900: kart Bitti, gecikmiş 1.500; stok 1.000 + Borç 500: gecikmiş 1.500 | 3 × 300 taksit + F 600 ayrı (gecikmiş 900); [500, 500] + Borç 500 (gecikmiş 1.000) |
| S120 = A | aynı yerde: elle kart, eşit tek elle borç yoksa yalnız ELLE borçlar s2 sırasıyla (vadesizde belge sırası) | — (bugün S2 bütün borçlar) | F 600 + X 500 + Y 700, kart 900 ⇒ kartta X 500 + Y 400; açık F 600 + Y 300 |
| S122 = A | `coveredLeftOf` :675–700 — tüketim sırası = kartın içine alma sırası (X sonra Y) → karta ödeme Kalan'ı o sırayla düşer (kural zaten bu; S120'nin sırasıyla değer kazanır) | — | karta 300 ⇒ X Kalan 200, Y Kalan 700 |
| S123 / S124 / S125 = C | ÖZEL KOD YOK — S120 kuralının doğal sonucu (yalnız elle borçlar s2 sırasıyla; artan kapasite S101 / kırpma) | sayılar raporda "BİLİNEN SINIR — sayılar" | değişmezler testle |
| S118 = B | routes/plans.mjs `withQueue` :224–266: `ownNext` + taksit başına `ownRemaining` (kartın kendi hesabı); client/assets/hof-plans.js `editEntry` :785 önerilen tutar kartın KENDİ kalanından + kuyruk kalanı küçükse tek satır bilgi notu. Sunucu sınırı, mutabakat, banka planı DEĞİŞMEZ | önerilen 600 (kuyruk) | 700 (kendi) + "Carinin avansı bu kartın 100,00 TL'sini kapatıyor." |
| Y2 (S91 = A sunumu) | `withQueue`: taksitlendirilmemiş kalan / Taksit İadesi (queueExtras) günü geçmişse kart 'Gecikti'; totals.overdue bu kalemi de sayar, ayrı alan `overdueRest`; hof-plans.js kart kutusu ve liste metni | taksitsiz ayrı kart 800: zil 800 gecikti, kart 'Geciken 0' | kart Gecikti, 'Geciken ₺800,00 · 0 taksit + taksitlendirilmemiş kalan' |
| Y4 | GÖZLEM: v2.4.9 hof-plans.js:417 ve routes/plans.mjs:1452 da kartın Kayıt Tarihi'ni (stoktan kartta carinin Kayıt Tarihi) gösteriyor → 2.5.0 getirmedi, DOKUNULMAZ (2.5.1 sunum) | — | — |

### 12.2 Kararlar arası etkileşim
| Birlikte | Okuma (karar metinlerinden) |
|---|---|
| S95 × S97 × S102 | geri alma yalnız ÖNCEKİ günlerin kalem ↔ kalem netleşmesi; en yeni önce; aynı gün kesin. Örnek S97 ertesi gün tahsilatla: Alacak 300 açık (kâhin Y5-1 'sıçrama', D 18:25 (1) kabul). |
| S98 × S104 × S105 | gelen ödeme: avans dahil tek vade sırası (S98 / S104); gelen YÜKÜMLÜLÜK kalemi (alış / Alacak): önce açık alış iadesi alacağı (S105), sonra tek vade sırası; avans ↔ kalem kapanışı kesin (S103) — geri alınan yalnız iki yükümlülüğün netleşmesi. |
| S99 × S101 × S110 × S120 | taksitli fatura kendi kartı (S99: bağsız para taksitleri vade sırasıyla kapatır, G2 de); Mevcut Borç kartı: O > T → S110 / S120 seçimi; O ≤ T → bütün açık borç (eski kural), eksik kısmın parayla kapanmışı ödenmiş taksit (S101), kalanı kırpılır. S110 kartının kendi borcu kısmen avansla kapanmışsa aynı S101 kuralı (karar (e) 11.11 03:15). |
| S50 / S2 / karar (1)–(6) | kart seçilmeden alınan tahsilat taksitleri de kapatır (S50) — ön ödenmiş taksit kapalıdır; bağ (karar (2)) önce; kilit (karar (3)) G2'de de aynı ölçüm; netleşme (5) yalnız NET görünümde (S95 geri alması da). |

### 12.3 Nasıl bozulur? (testler buradan)
sıra değiştir (yazım sırası ↔ belge tarihi; ödeme önce / borç önce / kart önce), aynı gün (S97 + S95; kart ile ödeme aynı gün), düzelt / sil / geri al (Alacak silinince geri alma kalkar; kart tahsilatı silinince ön ödeme aynı), kilitli dönem (kilitten önce netleşmiş kalemler + kilitten sonra ödeme; S99 kilitli dönemde taksitli fatura + avans), iki cari (aynı adlı), yedek geri yükleme (önbellek), v2.4.9 verisi (fark testi: yeni sınıflar), S101'in üç yüzü (ödeme satıştan sonra tarihli ama önce kaydedilmiş; karttan sonra kaydedilen geriye tarihli ödeme + kart tahsilatı; rastgele sıra), S110'da 1 kuruş fazla / eşit / az, iki kart aynı gün, Tablodan Aktar kartı (değişmemeli), S123–S125 (değişmez + çökme yok).

### 12.4 Hız etkisi (ders 53; ölçülecek istekler)
Kuyruğun hesabı değişen her istek: cari kartı, Cari Listesi, Vade Takip, zil / açılış, nakit akışı, fatura listesi / kartı, Taksitler listesi / kartı, kart yazım yanıtı, Borç Yaz / tahsilat yanıtı. Ek maliyet: (i) S95 geri alma — ödeme başına yalnız artan varsa, netleşme kayıtları cari içinde; (ii) S101 ek geçiş — yalnız eksik kalan Mevcut Borç kartı olan caride (en çok 3 geçiş); (iii) S110 seçimi kart olayında (aday listesi zaten var). Bütçe: tur 2b-1 tabanına göre kötüleşme yok.

### 12.5 Kodlama sırasında netleşenler (tur 2b-2; karar metinleri değişmedi — YORUMLAR rapora da yazıldı)
- **S101'in genel mekanizması (iki geçiş):** kartın tüketemediği kısım (`leftover`), kartın taşıdığı borcun (O ≤ T: kartın anına kadar kaydedilmiş bütün borç kalemleri; S110 / S120: seçilen
  kalemler) bağsız PARAYLA (kapatanı `payment` türü: tahsilat, alınan / verilen evrak, kart ve bağ fazlası) kapanmış kısmından ölçülür — olaylar BİTTİKTEN sonra (kartın günü borçtan önce
  olabilir, kapanış sonra gelir). Ölçülen tutar bir sonraki geçişte kart tahsilatından ÖNCE vadesi en önce gelen taksitten "Avansla Kapandı" diye yazılır (`prepay`); para dışı eksik son
  taksitten kırpılır. Kart tahsilatı açık taksit bulamazsa kart fazlası (`card-excess`) — carinin avansı, sonraki borcu kapatır. Kart fazlası başka kartın tükettiği borcu kapatınca o kartın
  ölçüsü değişir → kararlı olana dek en çok 12 geçiş (tohumlu rastgele 1.800 kuyrukta %90'ı 1, en çok 9). Önceki kartların saydığı para aynı kaleme iki kez sayılmaz (`advClaimed`).
- **Satışla açılan kartın "kendi satışı":** kartın kaydında satış kimliği yok (göç yazılmadı); kartın anına kadar EN SON kaydedilen borç satırı stok satışıysa ve tutarı kartın açıldığı andaki
  tutara (iade kesintileri geri eklenmiş) eşitse ya da kayıt anı kartla aynıysa (aynı işlem — iade sonrası küçülmüş eski kart, fikstür C) o satıştır. Excel / Tablodan Aktar kartı
  (`plans.import_id`) kararların dışında (eski kural).
- **S123 = C'nin doğal davranışı:** elle borçlar kartı doldurmuyorsa artan kapasite bu kartın ÖNCEKİ kuralıyla (öbür açık borçlar s2 sırasıyla) dolar — tabanın davranışı o kısımda sürer;
  elle borcu hiç olmayan caride kart boş kalmaz (literal "yalnız elle" okuması kartı açılır açılmaz Bitti yapardı). Sonucu S123'ün A seçeneğiyle aynı sayıyı verir — kural olarak değil,
  tabanın sürmesi olarak; BİLİNEN SINIR (rapor "BİLİNEN SINIR — sayılar"). S124: karar metninin harfi (eşit elle borç TEK değilse eskiden yeniye) — Z 300 + X'in 600'ü kartta. S125: s2
  (vade sırası) — Y 700 + X'in 200'ü kartta.
- **S110 tetiğindeki "carinin açık borcu":** kartın tüketebileceği kalemler + öbür kartların / taksitli faturaların açık taksitleri (kâhin Y8-1 ile aynı okuma); 1 kuruş fazla da fazla.
- **S95 geri alması:** yalnız NET görünümde ve yalnız iki YÜKÜMLÜLÜK kalemi arasındaki (ikisi de `due`) Otomatik netleşme; ödemenin kendi gününden önceki günler, en yeni önce (S102 /
  K2). Aynı gün ve aynı kayıt anlı iki kalemin listedeki yeri yazım sırasıdır (ders 31) — tyk-250 değişmezinin "girdi sırası ters" karşılaştırması küme karşılaştırması oldu (G3).
- **Mutabakat motoru (S99):** motor tek kuyruğu kurmaz; "taksitli faturanın açığı = kartın kendi kalanı (hedef)" eşitliği "açık ≤ hedef" oldu (üst sınır); kartın kendi kalanı = hedef
  denetimi aynen. Tek kuyruğun eşitliği cari kâhininde ve tyk-250 değişmezinde (karşı yönlü kalemi olmayan caride fatura açığı = net kuyruk).
- **S98 × S99 fatura durumunda (kâhin d25 R3 / d26 S13 / d27–d29 P3 / d33 T13c; §12.1'deki S99 satırının tamamlanması):** S99 = A "fatura listesi, kart, Vade Takip, zil AYNI sayıyı
  gösterir" + S98 = A "avans da kalemdir": fatura durumunda (side) karşı tarafın NETLEŞMEMİŞ bağsız parası (müşteriye yaptığımız Ödeme; tedarikçinin bize ödemesi) gelen bağsız paranın
  karşısında kendi günüyle (s2) kalemdir — müşteriye Ödeme 200 (01.03) · satış 100 · tahsilat 150 ⇒ fatura 100 açık, avans 50 (önce fatura 'Ödendi', Vade Takip 100: iki ekran ayrı
  sayı). Ters yönde de: müşterinin avansı 500 · ona geri Ödeme 300 · satış 500 ⇒ fatura 300 açık (önce 0). Karar (5) / Y4-3 korunur: karşı tarafın BELGE kalemleri (alış ↔ satış) fatura
  durumunda eşleşmez (yalnız Mahsup Et).
- **Takvim / zil ufku söz gününe göre (Ç5-B gerilemesi; kâhin c10 bg4, d10 l1, rastgele s042):** S67 = A gecikmiş borcun gün sayısını VADEDEN ölçer; ufuk ise (K6.3 "geçmiş + 7 gün",
  S67 "söz ufkun dışında → kalem yok") kalemin gösterildiği günden (söz varsa söz günü). v2.4.9'da gün sayısı söz gününden ölçüldüğü için ikisi aynıydı; Ç5-B'den sonra süzgeç gün sayısına
  bakıyordu ve +15 sözlü gecikmiş borç zilde / takvimde çıkıyordu. Vade Takip ve nakit akışı ufuksuz (değişmez).

## 13. Son tur (11.11.2026; Ç5-B'yi kapatan tur — tur 2b-2'nin devri + S126 = A, S128 = A + hız)
Kaynak: iş listesi D "Ç5-B SARMAL KURALI" (kullanıcı 11.11 14:12), "KULLANICI KARARI 11.11 11:16" (S126 = A), "13:29" (S128 = A), "HIZ KABUL ÖLÇÜMÜ" (08:49). Taban c5b-son-taban (86276ce4).
Bu turda kuyruğun KURALI DEĞİŞMEDİ (lib/obligation-queue.mjs'e dokunulmadı); ürün kodu değişikliği yalnız hız (aşağıda 13.3).

### 13.1 Tur 2b-2'nin devri (rapor vermeden durdurulmuştu)
Görev metninin "İş" maddeleri (1–10 + S122) kararın KENDİ örneğiyle gerçek programda (API) yeniden koşuldu — hepsi kararın sayısını veriyor (tablo: son tur raporu / docs/kanit/2026-11-11/
c5bson-karar-taban.json). Tur 2b-2'nin testleri tur 2b-1 ucunda 40 kırmızı (nedenleri karar numaralarıyla okundu), tabanda 239 / 239 iki saat dilimi.

### 13.2 S126 = A ve S128 = A — kural zaten kuyrukta (yeni kod YOK; koruma testi + mutant)
- Kartın **içine alma sırası**: açık borç ≤ kart tutarı iken (eski kural, `rule: "s2"`) kart açıldığı anda açık bütün borç kalemlerini — fatura, elle borç, stok veresiye satışı, karşılıksız kalemi —
  türüne bakmadan s2 sırasıyla (vade ↑ → belge tarihi ↑ → kayıt anı ↑) tüketir (`coverEvent`: `chosen = candidates`; `card.consumedFrom` bu sırayla yazılır).
- **Karta gelen ödeme** (kartın Taksit Tahsilatı + karta pay düşen bağsız tahsilat — S50) kalemleri aynı sırayla düşürür: `coveredLeftOf` (assemble) kartın taksitlerinden kapanan toplamı
  `consumedFrom` sırasıyla kalemlere dağıtır; faturanın açığı (G2) ve elle / stok / karşılıksız kaydın Kalan'ı (G1 `entries`) bu dağıtımdan okunur. Vadesiz kalemde vade = belge günü → sıra
  "eskiden yeniye". S122'nin (S120 kolu: yalnız elle borçlar) kuralı da aynı satırlar.
- Karar örnekleri gerçek programda: S126 — F 600 + X 300, kart 900, karta 300 ⇒ F açık 300, X Kalan 300 (bağsız 500 ⇒ F 100, X 300; 300 + 400 ⇒ F 0, X 200); S128 — S 400 + X 300, kart 700, karta
  300 ⇒ X Kalan 300, S açığı 100 (stok satırının Kalan'ı ekranda YOK — yalnız elle Borç / Alacak satırında; kuyruğun kayıt haritasında 100), bakiye 400, kart kalanı 400.
- **Vade ↔ belge sırası ayrışırsa** (S125 = C, BİLİNEN SINIR): özel kural yok — kuyruk vade sırasını kullanır (sayılar testte sabit: test/tyk-son-250 "BİLİNEN SINIRLAR"). S123 / S124 = C aynen
  (§12.5).
- **S128'in üçüncü türü ("başka kartın ya da taksitli faturanın taksiti"):** program Mevcut Borç kartının içine taksit ALMAZ (v2.0.23 "kart kartı tüketmez"; kart açma ucu taksitlendirilebilecek
  borcu kartsız açık borçla sınırlar — 400 `cover-exceeds`). Durum programda oluşmuyor; kural gerektiren yeni okuma çıkarsa TOPLU sorulur (sarmal kuralı (2)).
- Testler: test/tyk-son-250.test.mjs (saf kuyruk + gerçek program; taban kodda da YEŞİL — koruma testi), mutantlar test/tyk-mutasyon-250.mjs S126-a … S126-d, S128-a / S128-b (karşı seçenekler B).

### 13.3 Hız — tek carinin kuyruğu aynı veri durumunda bir kez kurulur (routes/invoices.mjs `obligationsOf`; en küçük değişiklik)
- **Kök neden (ölçüm: son tur raporu, docs/kanit/2026-11-11/c5bson-hiz-*.txt):** tur 2b-1 (G-1) kart yazım yanıtını ve kart okumasını tek carinin kuyruğuna indirdi; yanıt bütün carilerin izini
  (`accountPrints` — bütün tabloların tam taraması) artık yenilemiyor → iz taraması yazımdan sonraki İLK liste / zil okumasına kaydı; ayrıca yazımdan hemen sonraki kart okuması carinin kuyruğunu
  YENİDEN kuruyor, ilk zil okuması da artımlı yenilemede bir kez daha kuruyordu (aynı cari, aynı veri durumu, üç kez).
- **Değişiklik:** `obligationsOf(cari, defterVeren)` — (1) bütün carilerin önbelleği tazeyse (anahtar = `settleKey`: total_changes | data_version | gün) sonuç oradan; (2) değilse bu anahtarda
  kurulmuş sonuç küçük bir bellekte (en çok 16 cari) tutulur; kart ekranı / kart yazım yanıtı (routes/plans.mjs `queueFor`) ve `allSettled`'in artımlı yolu onu kullanır. Anahtar bütün cariler
  önbelleğininkiyle AYNI: her yazım ve gün dönümü anahtarı değiştirir → bayat sonuç verilmez; işlem içinde okunmaz, yazılmaz. Davranış AYNI (eşdeğerlik: test/tyk-onbellek-250 — tek cari
  önbelleği = baştan kurulan, her yazım türünden sonra, rastgele sırayla, bütün cariler önbelleğinden önce / sonra; sayaç testi test/tyk-son-250 "hız"; mutant HIZ-a … HIZ-d).
- **İz taraması yeniden yazım yanıtında (routes/plans.mjs `writeView`):** tek carinin belleği kart okumasını ve çift kuruluşu düzeltir, ama bütün carilerin izinin taranması
  (`accountPrints`; 100 bin satırda ~1 sn — profil: cari satırları %35, çek olayları üç sorgu %35, faturalar %14, taksitler %7) tur 2b-1'de yazım yanıtından çıkıp yazımdan sonraki
  İLK zil / liste okumasına kaymıştı (hedef (ii) "hiçbir tek yol kötüleşmesin" tutmuyordu). `writeView` kart yazım yanıtlarında (9 uç) görünümü kurduktan sonra bütün carilerin
  önbelleğini de yeniler (`queueOf()`): tarama çalışma dalındaki yerinde, carinin kuyruğu yine bir kez. Sonuç: her yol çalışma dalıyla aynı işi yapar (yazım ~1,3 sn, kart okuması ~3 ms,
  ilk zil ~2 sn), tur 2b-1'in "yazım 0,35 sn" kazancı BIRAKILDI. Seçenek (BAŞ MİMAR KARARI — son tur raporu): `writeView`'daki `queueOf()` satırı kaldırılırsa yazım 0,35 sn'ye iner,
  tarama ilk okumaya kayar (toplam aynı; art arda yazımlarda tarama yazım başına değil okuma başına bir kez). Sayaç testi test/tyk-son-250 "hız" (iz taraması 1 / 0 / 0), mutant HIZ-e.
- **Kapsam dışı (YAPISAL):** iz taramasının kendisini yazımdan da okumadan da kaldırmak — "kirli küme" (yazan yolun dokunduğu cariyi bildirmesi) önbelleğin yeniden tasarımıdır; bu
  turda YAPILMADI (ölçümler ve seçenekler son tur raporunda "BAŞ MİMAR KARARI GEREKİYOR"). Ucuz ara adım adayı (yapılmadı): çek olayları izinin üç sorgusunun tek sorguya inmesi.

### 13.4 Yapım aşaması listesinde kalan 'Ç5-B tur 2' kayıtları (72) — nedenleri (kuyruk kuralı eksiği YOK)
- 62 kayıt `kart:<ad>:kalan / odenen / taksitN:odenen` (d4, d30–d32, d34–d37): kâhin kartın TYK kalanını / ödenenini bekliyor; sürücü kartın KENDİ hesabını (`totals.remaining`, `totals.paid`,
  taksit `paid`) okuyor. Programda TYK değerleri ayrı alanlarda (`totals.queueRemaining`, taksit `remaining`); sürücünün kopyasında yalnız bu üç okuma kuyruk alanlarına çevrilince 62'si de
  kapanıyor, yeni fark 0 (not defteri c5bson-kahin; depodaki sürücü DEĞİŞMEDİ — test/bagimsiz yazılmaz). Kart penceresinin göstergeleri (Tahsil Edilen / Kalan) ve taksit satırının "Ödenen"
  sütunu da kartın kendi hesabı (S118 = B sınırı / öneriyi kartın kendi kalanına bağladı; göstergeler için karar yok) → son tur raporu "BAŞ MİMAR KARARI GEREKİYOR".
- 6 kayıt `cari:<ad>:gecikmis` (d11, d14, d15): carisiz evrakın karşılıksızında cari seçimi (S66) — sürücünün `KARSILIKSIZ_CARI` eşlemesi boş (adım gönderilmiyor); Ç5-A / eşleme.
- 4 kayıt c7-ks7 k3 (takvim / Vade Takip / projeksiyon kalemi): şüpheli kuyruğundaki kısım (M13) kalemden düşülüyor (§9 "Şüpheli kuyruğu vade kalemi değildir"), kâhin K6.3 "şüpheliye alma
  kalemi değiştirmez" bekliyor — bu turun kararlarında yok; TOPLU SORULACAKLAR.

### 13.5 Son uç doğrulaması (12.11.2026) — dişsiz kalan testler, ölçüm, geri yükleme
- **Mutasyon ilk koşusu 110 / 122 idi** (bu turun bulgusu; düzeltme YALNIZ testte): (a) tur 2b-2 önbellek testinin rastgele adımlarına yeni türler ekleyince tohum dizisi kaydı — iz kolonu
  mutantları Y3-b … Y3-e ve N09 tur 2b-2'nin kendi ucunda da YAŞIYORDU → test/tyk-onbellek-250 "iz kolonları tek tek (durağan saat)" (bağ, kartın Kayıt Tarihi, taksit vadesi, dönem kilidi —
  her adımda sonuç DEĞİŞMELİ + önbellek = baştan kurulan); (b) S101-c (para dışı kapanış da 'avansla ödenmiş' sayılır) hiçbir testte yakalanmıyordu → test/tyk-son-250 "S101 sınırı";
  (c) O2 / G1 mutantlarının enjeksiyon metinleri bu turun `writeView` / `obligationsOf` satırlarına güncellendi. Son uçta 122 / 122 (API tabanı 287 / 287).
- **Ölçüm** (temiz 100 bin satır, ölçüm kilidiyle; ham çıktı docs/kanit/2026-11-11/c5bson-hiz-*.txt): 11.11'de 16 / 16 geçerli koşu — yazım + kart okuması + ilk zil toplamı çalışma dalı 3148 ms,
  tur 2b-1 3630, yalnız bellek 3293, son tur 3316; 12.11'de (ikinci turun 8 geçerli koşusu; ilk turun altısı baştaki yük > 2 olduğu için özete girmedi) 3216 / 3622 / 3059 / 3102. Son tur
  çalışma dalıyla ±%5 içinde (iki ölçümde işaret ters — fark gürültü düzeyinde); tur 2b-1'in ilk zil okumasındaki +%55–61 kapandı.
  İKİLİ ölçüm (12.11 11:35, yalnız çalışma dalı ↔ son uç, 3 tur × 2 tekrar, 12 / 12 geçerli, baştaki yük ≤ 1,55): toplam 3090 → 3247 ms (+%5); kart tahsilatı yazımı +%5, ilk zil +%5,
  ilk Vade Takip +%4, Borç Yaz / nakit tahsilat +%3, nakit akışı +%1, ılık Vade Takip −%2. SINIRI AŞAN iki yol: **ılık zil 484 → 547 ms (+%13;** önceki iki ölçümde +%5 ve +%6 — tur 2b-1
  sütununda da +%7 / +%9, yani bu turun belleğinden değil) ve **açılış 19,6 → 21,8 sn (+%11;** önce +%5). Kök neden profili alınamadı (ölçüm kilidi doluydu) — son tur raporu
  "BAŞ MİMAR KARARI GEREKİYOR".
- **Geri yükleme**: S126 gerçek program testi bağsız tahsilatı silip Silinenler'den geri de yükler (bütün ekranlar silinmeden önceki hâle döner).

## 14. Kapanış düzeltme turu (12.11.2026; kapanış dar kontrolünün bulguları — ORTA-1, ORTA-2, DÜŞÜK-2 … DÜŞÜK-4 — + S129 = A + hız)
Görev metni docs/devir/2.5.0-DEVAM/c5bkd-istem.txt; dar kontrol raporu docs/devir/2.5.0-DEVAM/dk-c5bkap-rapor.md. Altı madde, altı commit. Karar metinleri değişmedi; YORUMLAR raporda.

### 14.1 ORTA-1 (GERİLEME; S110 = A) — satışla açılan kartın kaynağı KALICI bilgiden
- **Kök neden**: tanıma "bugünkü tutar + iade kesintisi = satış tutarı" ya da "kayıt anı eşit" koşuluna dayanıyordu; tutar düzenlenince ve gerçek (akan) saatte ikisi de tutmuyor, kart elle kola
  (S120) düşüp carinin elle borcunu içine alıyordu. Testler durağan saatle yeşildi (ders 14).
- **Kaynak**: kartın açılış izi (`plan.created`). Bundan sonra açılan kartta izde satışın kimliği yazılı (`saleMoveId`; elle / toplu kartta alan BOŞ yazılır — çıkarım yapılmaz). 2.4.9'a kadarki
  veride alan yok: kaynak izden ÇIKARILIR — kartın açılış izinden hemen önceki iz aynı kullanıcının, aynı cariye, kartın AÇILIŞ tutarında veresiye stok satışıysa (satış ve kart aynı işlemde art
  arda yazılır) kaynak o satıştır. Göç numarası EKLENMEDİ (şema değişmedi; Ç5-A'nın göçleriyle çakışma yok): okuma `routes/plans.mjs saleSources` (dizinli; işlem dışında bellekte).
- **Kuyruk**: kart satırı `coverSale` taşır; `saleItemOf` kimliği taşıyan BORÇ yönlü satış satırını bulur (iade / alış iadesi satırını değil). Kaynak bilinmiyorsa (elle kart; izi olmayan eski
  kart; satış silinmiş) ESKİ tanıma AYNEN — S133 = C (BİLİNEN SINIR): elle kartın tutarı en son taksitsiz stok satışına eşitse sonuç kayıt sırasına bağlı (karar2 Ç1 gecikmiş 0, Ç1b 500 — testle sabit).
- **Testler ADIMLI saatle** (her okumada 7 ms ilerleyen saat — "kayıt anı farklı" ön koşulu zorla kurulur ve veri tabanından okunarak doğrulanır): test/tyk-kapanis-250.test.mjs.
- **v2.4.9 fark testi**: fikstür v2.4.9'un gerçek koduyla yeniden üretildi (46 eski sınıf birebir aynı) + V1 Tutarı Düzenlenmiş, V2 İadeyle Küçülmüş, V3 Faturasız İade, V4 Kartı Kapat
  (beklenen farklar 101 → 116; her yeni fark karar numarasıyla).
- **Gözlenebilir değişiklik** (bakiye hepsinde aynı): tutarı düzenlenmiş satış kartı (1.000 → 800; elle Borç 500 ayrıca) gecikmiş 1.200 → 700 (= Ç5-B öncesi); iadeyle 800 küçülmüş satış kartı
  taksit [500, 200] gecikmiş 500 → [0, 200] gecikmiş 0, Borç 500 kendi vadesinde ayrı (= Ç5-B öncesi; v2.4.9 [500, 200] idi — TOPLU SORU TS-K1).

### 14.2 ORTA-2 — "kalemler toplamı = cari bakiyesi" her girdide
- **Kök neden**: ön ödeme ölçümü döngüsü sabit 12 geçişte kesiliyordu; ölçüm geçiş başına küçük adımla ilerleyen girdide (geriye tarihli Alacak + kart tahsilatı: geçiş başına 20 TL) döngü
  yakınsamadan bitiyor, kart tahsilatı var olmayan taksiti kapatmış kalıyor, kalemler bakiyeyi aşıyordu (960 ↔ 940).
- **Düzeltme**: sınır girdinin büyüklüğüne bağlı — iş bütçesi (geçiş × cari satırı) sabit: küçük caride 400 geçişe kadar, çok satırlı caride en az 12 (`prepaidPassLimit`; ders 47: tek carinin
  kuyruğu saniyelere çıkmaz). Sınırda da yakınsamazsa son ölçüm GÜVENLİ KAPANIŞLA uygulanır (`settleExcess`): kart tahsilatının var olmayan taksite yazdığı pay en son taksitten geri alınır,
  para kartın fazlası (carinin avansı) olur ve kendi gününde bağsız ödeme gibi dağılır — toplam asla bakiyeyi aşmaz. Yakınsayan caride bu dal çalışmaz.
- **Değişmez testi**: test/tyk-kapanis-sigma-250.test.mjs — geriye tarihli üretici, 80 tohum × 250 cari (20.000 cari; 12'den çok geçişli 409, güvenli kapanış 1, en çok 400 geçiş; ~4 sn).
  100 bin satırlık temiz veride (1.484 cari) 12'den çok geçiş isteyen cari YOK — hıza etkisi yok.
- Sonuç alanı `prepaidPasses: { count, stable }` — `count` kararlı geçişten ÖNCEKİ geçiş sayısıdır (ilk ön ödemeli geçişte yakınsayan caride 0).

### 14.3 S129 = A — kartın gösterilen sayıları tek kuyruktan; alan adları AYRILDI
- Kart yanıtında `totals.paid / remaining` ve `items[].paid` GÖSTERİLEN sayıdır (Tahsil Edilen = taksitin kuyrukta PARAYLA kapanan kısmı — kuyruk `collected`; Kalan = Toplam − Tahsil Edilen).
  Kartın KENDİ hesabı `totals.ownPaid / ownRemaining`, `items[].ownPaid / ownRemaining` (lib/plans.mjs allocate her yerde verir): Mutabakat Testi (`plans:totals`), mutabakat kapısı, mutabakat
  motoru, K8 sınırı ve S118 = B (form sınırı / soru / öneri) bunları okur. İç çağıranlar (kartı bakiyeye göre kırpma, taksitlendirilebilecek borç, WhatsApp, fatura kapaması) kartın kendi hesabında.
- Aynı sayı: kart penceresi, Taksitler listesi + PDF, taksit ekstresi ve makbuz PDF, Rapor Merkezi (Taksit Kartları, taksit vadeleri / gecikenler, aylık performans), cari kartının taksit özeti ve
  Taksitten Kalan, Cari Listesi ekran / PDF / Excel, cari ekstresi özeti.
- Kararın SÖYLEMEDİĞİ dört durum bugünkü gösteriminde bırakıldı (TOPLU SORULACAKLAR): elle Alacak'la netleşme (tahsilat değildir — kâhin d19 N4), Mevcut Borç kartının taksitlere bölünmemiş
  kısmı, kartın kendi fazla tahsilatı (K8 "Fazlasını Avans Yaz"), kapatılmış kart.
- DÜŞÜK-4: satırdaki ₺ düğmesi ve "Hangi Taksite" listesi kartın kendi kalanından; açıklama satır durumuyla çelişmez.

### 14.4 Ara sıra düşen ekran senaryosu ('zilde: []') — kök neden TEST yarışı
Zil paneli sayfanın BELLEKTEKİ takviminden kurulur ve açıldıktan sonra kendini yenilemez; sayfa takvimini sunucudaki değişiklikten ≥ 0,8 sn sonra, en sık 4 sn'de bir yeniler. Senaryo API ile
yazıp hemen zili açıyor, 300 ms bekleyip okuyordu. Zorlama (test/e2e/zil-yaris-zorla.mjs — sayfanın takvim isteğinin yanıtı bekletilir): eski yardımcı 34 / 40 (altı okumada 'zilde: []';
sunucunun yanıtında kalemler VAR), yeni yardımcı (test/e2e/zil-oku.mjs — sayfanın takvimi sunucunun güncel sürümüne yetişene kadar bekler) 51 / 51. Ürün değişmedi.

### 14.5 Hız — kök neden düzeltmesi (iş listesi D'deki "ılık zil her çağrıda bütün carilerin kuyruğunu yeniden kuruyor" okuması YANLIŞ)
- **Profil (yalnız ılık döngü; 100 bin satır)**: takvimin ılık çağrısında KUYRUK KURULMUYOR. Süre: ~21 MB'lık yanıtın JSON'a çevrilmesi (~130 ms) + önbellek anahtarının parmak izi sorguları
  (~115 ms) + ölçüm istemcisinin gövdeyi çözmesi (~120 ms) + çöp toplama (~60 ms). Ç5-B ile yanıt %5 büyüdü (37.477 → 39.460 kalem: kart 16.525 → 18.720, fatura 6.676 → 7.100, cari
  11.973 → 11.337 — kararların sonucu). Ekranın gerçek çağrısı (elindeki sürümü gönderir) ~100 ms ve Ç5-B'den etkilenmedi.
- **Değişiklik 1** (routes/dues.mjs `bodyOf`, lib/http.mjs `sendBody`): yanıt gövdesi, hesabın sonucu değişmediği sürece kişinin görebildiği kalem türleri başına bir kez üretilir (WeakMap —
  sonuç nesnesi değişince bırakılır; en çok 3 görünürlük çeşidi). Baytlar birebir aynı.
- **Değişiklik 2** (routes/invoices.mjs `chequeLinkMoments`): Borç Yaz'daki tek ek iş kilit açıkken çek / senet bağı anları sorgusuydu (bütün ilk olaylar taranıyordu: ~16 ms); tek cari sorgusu
  carinin kendi evrak satırlarından sürülür (14,9 → 0,18 ms; 1.484 cari / 102.295 defter satırında harita aynı).
- **Motora dokunulmadı**: dar kontrolün üç "tembel" yaması denendi — kazanç %2–4, ölçüm gürültüsü (±%5) içinde. Motorun Ç5-B ile artan süresi (aynı girdilerle ~+%19; kartlı carilerde kart
  başına ön geçiş) yapısal iştir (2.5.1); ılık zile ve Borç Yaz'a etkisi yoktur, açılışa ve yazımdan sonraki ilk okumaya vardır.
- **Öneri (2.5.1; kapsam dışı)**: parmak izi sorguları (~115 ms; ekranın sürümlü çağrısının tamamı) veri tabanı değişmediyse yeniden koşmayabilir (kuyruk belleğinin anahtarıyla aynı düzen).

### 14.6 DÜŞÜK-2 (yaşayan mutantlar) ve DÜŞÜK-3 (mutabakat motoru)
- K5, K6, K24, K25 → test/tyk-kapanis-250 (madde 1). K3, K8, K22, K28, K35 → test/tyk-kapanis-dis-250.test.mjs (K22: Tablodan Aktar'ın çağırdığı servisle açılan aktarım kimlikli Mevcut Borç
  kartı; K28: ödeme kuruluşu POS'unda valörden önce tam iade → "POS Komisyon Tahsili"). K1: gözlenebilir farkı bulunamadı — asıl ↔ mutant motor çok kartlı geriye tarihli üreticiyle 40.000
  caride (27.457'si çok kartlı; aynı üretici K3'ü 2.000 carinin 430'unda ayırıyor) ve 100 bin satırlık verinin 1.484 carisinde birebir aynı; koşul yalnız döngünün kararlılığını korur.
- Mutabakat motoru (test/mutabakat/motor.mjs): taksitli faturanın açığına ALT SINIR — fatura durumunda kapanmış görünen her kuruşun bir kapatanı vardır (açık + kapatanların toplamı ≥
  ödenecek) + "açık kalemlerin toplamı = modelin bağımsız cari bakiyesi" (koşucu programın kuyruğunu aynı süreçten okur — test/mutabakat/sigma.mjs; HTTP ekranları karşı yönlü avansı
  kalem saymadığı için oradan kurulamaz).
- **Dar kontrolün önerdiği alt sınır ("açık ≥ kartın kuyruk kalanı") KULLANILMADI — YENİ BULGU (kapsam dışı; düzeltmeden önceki kodda da var)**: 500 işlemde tutuyor, 5.000 işlemlik
  koşuda uyarı veriyor (taban kod, tohum 1, 273. işlem): kart fazlası ("Taksit kartından artan ödeme") fatura durumunda (G2) taksitli faturanın taksitlerini kapatıyor (fatura Ödendi),
  net görünümde (G1) ise önce müşteriye verilen avansı / başka kartın taksitini — fatura listesi "açık 0", kart / Vade Takip / zil "783,88 açık". S99 = A "aynı sayı" ile çelişir
  (neden adayı: G2'de karşı tarafın avansına karşı yalnız cari kartı parası ve evrak "bağsız para" sayılıyor, kart fazlası sayılmıyor). Bakiye iki görünümde aynı. Yeniden üretim ve
  döküm: docs/kanit/2026-11-12/c5bkd-s99-bulgu.
