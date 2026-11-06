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
