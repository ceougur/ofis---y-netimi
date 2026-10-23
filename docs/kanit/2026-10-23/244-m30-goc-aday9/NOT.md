# 2.4.4 madde 30 (yargıç Y3) — göç karşılaştırması SON ADAY (aday 9 = 6dc52d6) koduyla yeniden

Aday: `aday9` = 6dc52d6 (dal is/goc9). Önceki koşu: aday 6 = e070d42 (`docs/kanit/2026-10-22/244-m30-goc/NOT.md`; yöntem, araçlar ve ilk 12 maddelik
"Nasıl bozulur?" listesi orada, burada da geçerli). Eski kod: git etiketi v2.4.3 (zincir için v2.3.0 ve v2.0.26 fikstürü), ayrı kopyada (ders 23, 25).

## Göç kodu aday 6'dan beri değişti mi? (`git diff e070d42 6dc52d6 -- server/lib/`, işe başlamadan okundu)
- `server/lib/migrations.mjs` v32 `scanPaperFloors` DEĞİŞTİ (a9d5c8b, E6): taban taramasına Silinenler'de duran (geri yüklenmemiş) belgenin kendi numarası
  eklendi (seri FIS / SMM / IAD ya da Fatura Ayarları'ndaki kâğıt / SMM / iç seri; `trash` tablosu, `kind = 'invoice'`, `restored_at IS NULL`). v31 aynı.
  → kesinti noktaları TAM koşulur (v32 içinde dahil) ve zincir ×2 yeniden koşulur.
- `server/lib/company-backups.mjs` DEĞİŞTİ (dd0e77a, 30b): geri yüklenen dosyaya `invoice.restoreNotice` ayarı (Fatura'da tek seferlik uyarı). Göçün kendisi
  değil; geri yükleme yolu (tatbikat C6/C9) ve dosya olgusu (ayar sayısı) etkilenir.
- Öbürleri göç kodu değil, okuma kuralı: `insight/dues.mjs` + yeni `insight/debt-column.mjs` (30a/E2/E3/U2), `reports.mjs` (U2, MM6), `general-ledger.mjs` +
  `doubtful-gl.mjs` (MM8 yevmiye sırası), `report-pdf.mjs` / `report-files.mjs` (U3), `invoice-pdf.mjs` (MM4/MM7/MM11), `einvoice/iptal-suresi.mjs` + `edm.mjs`
  (E1/E4 gönderim izi), `tax-id.mjs` (U1, MM11 metin), `invoice-math.mjs` (yalnız yorum, MM10 değişmez).

## Nasıl bozulur? — aday 9 değişikliklerinin göçteki olası etkileri (işe başlamadan yazıldı; testler ve sınıflayıcı kuralları bu listeden)
13. E6 v32 taban taraması Silinenler'i okur: 2.0.x–2.4.3'ün yazdığı çöp kutusu yükü farklı biçimde (yük yok, `invoice` alanı yok, seq 0, numarasız taslak,
    e-Belge serisi, başka yıl) → göç düşer ya da yanlış seriyi yükseltir. Silinen belgenin numarası 2.4.3'te bu arada yeniden verildiyse (seri MAX(seq) ile geri
    gelir) taban yanlış yere kayar. Geri yüklenmiş (restored_at dolu) öğe yine sayılır. Taban yükselmesi sıradaki numarayı değiştirir → beklenen KURAL (kararın
    metni): sıradaki = 1 + eski veride VERİLMİŞ en büyük numara, SİLİNENLER DAHİL; geri yüklenmiş öğe ayrıca sayılmaz (canlı belgesi zaten sayılır).
    → Üreticiye silme ve Silinenler'den geri yükleme eklendi (v2.4.3 / v2.3.0 kendi uçları: `DELETE /api/workspace/invoices/:id`, `POST /api/admin/trash/restore`).
14. E6 geri yükleme: göçten sonra 2.4.3'ün Silinenler'deki belgesi 2.4.4'te geri yüklenince numarası canlı başka belgedeyse iki belge aynı numarayı alır
    (2.4.3 sıra numarasını düşürüp numara metnini bırakıyordu) → beklenen (karar): 409, belge Silinenler'de kalır; numarası boştaysa kendi numarasıyla döner.
15. 30a / E2 / E3 / U2 (borç sütunu): Kalan Borç önceliği eski veride Toplam'dan Kalan'a geçer (karar); ama Kalan hücresi BOŞ satırda Toplam'a dönmezse borç 0
    olur; "Kalan Gün" gibi gün/adet sütunu borç sayılırsa tek tutarlı tablolarda borç gün sayısı olur; Ödeme Sözleri sekmesindeki söz tutarı ya da aynı dosya
    no'nun ikinci sekmedeki satırı borca eklenir/eklenmez; daraltma gereği "Aylık Ücret", "Ödenecek" gibi tek tutar sütunları 2.4.3'teki gibi borç kalmazsa
    tablo sessizce boş görünür. → Üreticiye Kalan Borç'u boş satırlar, "Servis Ücretleri" (Aylık Ücret + Kalan Gün) ve "Aidatlar" (Ödenecek + Daire Adedi)
    sekmeleri eklendi. Beklenen KURAL kayıt başına eski verinin kendi satırlarından (2.4.4 kodundan değil).
16. MM6 Nakit Akışı Kasa sütunları: yeni kural bütün Kasa hareketlerini alır → beklenen = eski verinin (2.4.3'ün) Kasa raporundaki giriş/çıkış toplamı (kuruş).
17. MM8 Yevmiye aynı gün sırası: sıra değişince satırlar kaybolur/çiftlenir, gün toplamları ya da mizan kayar → beklenen: satır kümesi ve toplamlar aynı, yalnız
    aynı gün içinde sıra (belge önce, tahsilat/ödeme sonra).
18. MM3 Stopaj ve Tevkifat Özeti: iadenin tarafı değişince öbür satırlar da kayar → beklenen: yalnız iade satırları (asıl belgenin tarafında, eksi) farklı.
19. U3 tablo raporu çıktılarının adı ve TOPLAM satırı: ad değişikliği öbür raporlara sızar → yalnız tablo raporları; TOPLAM = satırların toplamı.
20. E1/E4 gönderim / iptal izi: eski veride iz kaydı yok → "Sonucu Belirsiz" kuralı eski gönderimleri yanlışlıkla belirsiz sayar ya da iptal süresi (K-23) kayar
    → e-Belge kartları ve iptal penceresi aday 6'daki gibi (K-23) kalmalı.
21. E7 Yalnız Programda İptal K4: eski verideki kabul edilmiş / gönderilmiş belgede düğme kapanır (karar), başka bir kart bayrağı değişmemeli.
22. 30b geri yükleme uyarısı: normal göçte (geri yükleme yok) uyarı ÇIKMAMALI; geri yüklemeden sonra bir kez; kapatılınca silinir; uyarı ayarı tatbikat
    karşılaştırmasını (olgular = yedek anı) bozmamalı.
23. MM4 / MM7 / MM11 makbuz adları ve "bırakılan kâğıt makbuz e-SMM'e gönderilmez": eski veride bırakılmış SMM yok (2.4.3'te e-SMM kapalı) → göç sonrası
    yeni bırakılan makbuzun gönderimi 409 olmalı (tatbikat C2).
24. U1 Nihai Tüketici: eski veride adı belli 11111111111'li cari varsa göç sonrası "Nihai Tüketici" onu seçmemeli — göç kodu değil, ilk kullanımda (DENENMEYEN
    olursa yazılır).
25. UX17 kısmi ödenmiş kartta kalan; E5 Personel 409: göç sonrası olgularda yalnız metin/alan; para olgusu değişmemeli.

## Yöntem ve yeniden koşma (araç commit'leri 59bbd64 → 038add2 → 24674b5 → 625e9eb → 9058e98, yalnız araç; ürün kodu aday 9 = 6dc52d6, değişmedi)
```
S=<not defteri>; R=$S/m30-goc/aday9; export TMPDIR=$R/tmp; N="node --disable-warning=ExperimentalWarning"; K="flock $S/kos.lock node tools/kanit.mjs kos 244-m30-goc-aday9"
$K/uret-v243-buyuk      -- $N tools/m30-goc.mjs uret --kok $R --hacim buyuk --tohum 7            # v2.4.3 GERÇEK kodu (163dd5d), API'den
$K/olcu-v243-taban      -- $N tools/m30-goc.mjs olcu --kok $R --surum v2.4.3 --veri taban --ad v2.4.3-taban
$K/goc-v243-244-buyuk   -- $N tools/m30-goc.mjs goc --kok $R
$K/fark-v243-244-buyuk  -- $N tools/m30-goc.mjs fark --kok $R
$K/tatbikat-buyuk | donus-buyuk | kesinti-buyuk -- $N tools/m30-goc.mjs tatbikat|donus|kesinti --kok $R
$K/uret-v230-kucuk      -- $N tools/m30-goc.mjs uret --kok $R --surum v2.3.0 --hedef zb-taban --hacim kucuk --tohum 11
$K/zincir-v2026-fikstur -- $N tools/m30-goc.mjs zincir --kok $R --ad za --kaynak fikstur:surum-2.0.26-turler --yol v2.1.0,v2.2.0,v2.3.0,v2.4.3
$K/zincir-v230-uretilen -- $N tools/m30-goc.mjs zincir --kok $R --ad zb --kaynak zb-taban --yol v2.4.0,v2.4.1,v2.4.2,v2.4.3
$K/yeniden-uret-g1      -- $N test/guvenilirlik/m30-yeniden-uret.mjs g1
```
Ağır adımlar aday 9'un tam `npm test`'inden SONRA başladı (`244-ana/aday-9-npm-test.json` 01:23 UTC, 3.283/3.283). Önce/sonra aynı sabit sahte an (üretimin son günü
17:00; ders 13, 22). Sınıflayıcının yeni kuralları kararların METNİNDEN ve eski verinin kendi kayıtlarından (dataset_rows, trash, audit_events — 2.4.3'ün yazdığı);
2.4.4 kodundan türetilmedi (ders 5). Ham olgular (2 × ~29 MB) not defterinde (`m30-goc/aday9/cikti/`), depoda fark/denetim çıktıları.

Araç eklentileri (aday 9 kararları için): üreticiye silme (kâğıt fatura / Müşteri Fişi / SMM) + Silinenler'den geri yükleme + son gün "serinin son makbuzu silinir"
(E6), tabloya boş Kalan Borç hücreleri + "Servis Ücretleri" (Aylık Ücret + Kalan Gün) + "Aidatlar" (Ödenecek + Daire Adedi) sekmeleri (30a/E2/E3/U2); olgulara
Yevmiye'nin BÜTÜN satırları (Excel çıktısı; gün başına satır kümesi + madde sırası — MM8), Silinenler, geri yükleme uyarısı (30b); tatbikata C10 (30b), C2b (bırakılan
kâğıt makbuz gönderilemez), C11 (E6 geri yükleme).
İlk dört üretim denemesi ARAÇ hatasıyla düştü, kanıt sayılmadı (not defterinde `*-uret-basarisiz.*`): (1–2) Gönderilecekler listesinde gönderilmeyi beklemeyen belge
(iptal edilmiş numarasız e-Arşiv; e-Belge durumu "none" alıştan iade) "Müşteri Fişi Olarak Bırak"a verildi → 409 invoice-not-waiting (üretici artık yalnız "waiting"
belgeyi seçer; 2.4.3 bu belgeleri Gönderilecekler'de gösteriyor — gözlem); (3–4) 409 ledger-integrity → G1 (aşağıda, ÜRÜN). Ölçü adımının özet satırı yoktu (kanit
BELİRSİZ) → eklendi, yeniden koşuldu.

## Veri (v2.4.3 GERÇEK kodu 163dd5d, API'den; 6.206 istek: 6.201 × 200 + 5 beklenen ret (1 silme 409 "senet tahsil edildi", 4 G1 ledger-integrity); 174 sn;
## sahte EDM 485 gönderim, 11 iptal, ihlal 0)
Çizelge 23.09.2025 → 23.10.2026 (13 ay, iş günleri). 7. ayda e-Belge; 10. ayda 001'de dönem kilidi (23.04.2026'ya kadar, 23.07.2026'da kondu).
| | 001 | 002 |
|---|---|---|
| Cari | 3.211 (Σ bakiye 10.970.566,26 TL) | 926 |
| Tablo | 10.240 satır, 5 sekme (Borçlular, Ödeme Sözleri, Taksitler, Servis Ücretleri, Aidatlar; Kalan Borç'u boş satırlar %6) | 1.780 |
| Fatura | 1.178 (kâğıt 822, e-Arşiv 295, e-Fatura 61; bırakılmış 28) | 620 |
| Silinen fatura | 18 (12'si geri yüklendi; 6'sı Silinenler'de; son gün silinen SMM2026000000067) | 19 (6 geri yüklendi; 13 Silinenler'de; 7'sinin numarası canlı belgede) |
| Çek / senet · taksit · Kasa | 430 · 228 kart · 2.064 satır | 170 · 83 · 892 |
| Veri dosyası | 20,1 MB | 8,0 MB |

## Göç (2.4.4 aday 9 aynı klasörde; kayıt goc-v243-244-buyuk: 2/2)
001 açılışta: göç öncesi yedek ~86 ms + v31 5 ms + v32 8 ms (açılış toplamı 621 ms); 002 ilk erişimde: yedek ~56 ms + v31 3 ms + v32 3 ms (ilk istek 237 ms). Şema 30 → 32,
integrity_check ok. v32 numara tabanı (E6 dahil): 001 {FIS2026: 259, SMM2026: 67 (silinen)}, 002 {FIS2026: 110, FIS2025: 73 (silinen), SMM2026: 120 (silinen)}.

## Önce (v2.4.3) / sonra (2.4.4 aday 9) — 100 olgu: EŞİT 57 · BELGELİ 43 · BULGU 0 (`fark-v243-244-buyuk`, sınıflayıcı 24674b5; tam döküm `cikti/fark-v2.4.3-taban-guncel-goc.json`)
EŞİT (iki şirkette tek tek): her carinin bakiyesi (001: 3.211, Σ 10.970.566,26 TL; 002: 926), mizanın her hesabı (borç = alacak), defter mutabakatı (16), Mutabakat
Testi (0 sapma, 87 denetim), dönem kilidi, Kasa (toplam, yol başına, 2.064 / 892 satır), banka hesapları, Banka özeti, her çek/senet (430 / 170), her taksit kartı
(228 / 83) ve toplamları, stok, KDV Mahsup Fişleri, tablo, şüpheli alacaklar, Gönderilecekler, seri adları, faturaların türü/durumu/numarası/ETTN/tarihi/carisi/
profili/e-Belge durumu/tutarı (1.178 / 620), Silinenler (6 / 13 öğe — göç çöp kutusuna dokunmadı), geri yükleme uyarısı YOK (30b), sıradaki earsiv/efatura/internal
(= 1 + verilmiş en büyük), rapor merkezinin öbür 56 raporu (Stopaj ve Tevkifat Özeti dahil), şirketler, roller, kullanıcı yetkileri.

| Olgu | aday 6 (e070d42) | aday 9 (6dc52d6) | Sınıf — karar; kuralın denetimi (eski verinin kendi kayıtlarından) |
|---|---|---|---|
| Tablodaki Kişiler — kayıt borcu | BELGELİ K-5/F4/K-5c (Toplam Borç) | 001: 188.147.300,00 → 174.458.300,00 TL (fark 13.689.000,00); 002: 30.759.000,00 → 28.831.500,00 | BELGELİ 30a + E2 + E3 + U2 + K-31a F4. Her kayıt (001: 9.640, 002: 1.630) kuruşu kuruşuna: sonra = Σ satır borcu (Kalan Borç doluysa o, boşsa Toplam Borç; Taksitler "Toplam"; Servis "Aylık Ücret", "Kalan Gün" değil; Aidat "Ödenecek", "Daire Adedi" değil; Söz Tutarı 0); önce = ilk sekmenin Toplam Borç'u (2.4.3 yalnız ilk sekmeyi çözümlerdi). Ayrıştırma 001: 30a Toplam−Kalan 17.442.000,00 − F4 Taksitler 3.172.200,00 − Servis 442.800,00 − Aidat 138.000,00 = 13.689.000,00 (açıklanamayan 0); 002: 2.944.700,00 − 823.200,00 − 146.500,00 − 47.500,00 = 1.927.500,00. Söz tutarı (001: 1.970.200,00) iki sürümde de borç değil |
| Tablodaki Kişiler — tahsilat | BELGELİ | 001: 452 kayıt, 002: 142 | BELGELİ K-5 / K-31a F1-F4-F5 / K-5c (aday 6'daki kural) |
| Vade Takip / Tahsilat Takvimi söz tutarı Toplam → Kalan | **BULGU B1** | 001: 1.048 kayıt 21.107.100 → 15.825.800 TL; takvim 917 kayıt; 002: 159 / 135 | BELGELİ 30a (kullanıcı kararı 22.10 ~16:55); kayma yalnız Kalan Borç'u DOLU satırlarda (boş satırda Toplam kalır — E2) |
| Nakit Akışı | BELGELİ (Kasa aynı) + B1 | Kasa giriş 803.115,53 → 2.946.374,61; çıkış 194.028,60 → 482.762,96 (001) | BELGELİ MM6: Kasa sütunları = 2.4.3'ün KENDİ Kasa Hareketleri raporu (Dönem Giriş 2.946.374,61 / Çıkış 482.762,96 — kuruşu kuruşuna, iki şirkette); Beklenen farkı (−5.281.300,00) = Vade Takip farkı (−5.281.300,00); Gerçekleşen K-5/F5 |
| Yevmiye (bütün satırlar, Excel) | — (ön izleme EŞİT) | 001: 10.873 satır, 288 gün, 284'ünde sıra değişti; 002: 4.794 satır, 288 gün, 280'inde | BELGELİ MM8: her günün satır KÜMESİ aynı; sonra hiçbir günde belge (fatura/makbuz) tahsilat/ödemeden sonra değil (önce 281 / 226 günde öyleydi); TOPLAM ve Madde/Satır özeti aynı |
| Sıradaki numara · paper | BELGELİ K-v32 | 001 FIS…259 → 260; 002 FIS…109 → 111 | BELGELİ K-v32: = 1 + verilmiş en büyük |
| Sıradaki numara · smm | EŞİT/BELGELİ | 001 SMM…067 → 068; 002 SMM…120 → 121 | BELGELİ K-v32 + **E6**: verilmiş en büyük SİLİNEN belgede (son gün silinen makbuz; canlıların en büyüğü 066 / 119); 2.4.3 aynı numarayı yeniden verirdi |
| Faturaların ödeme durumu / ANLIK DURUM / 4 rapor | BELGELİ K-UX18 | 001: 62 fatura, 53 cari, +456.588,95 TL açık; 002: 24 / 21 / +182.338,66 | BELGELİ K-UX18/F2/F3 (aday 6 kuralı tuttu) |
| e-Belge kartı İptal Et | BELGELİ K-23 | 268 / 105 kapandı | BELGELİ K-23 (iletim + 8; E1/E4 izi eski veride yok → değişmedi) |
| Diğer | K-24, K-5 metin, K-19, şema/ayar | aynı | BELGELİ |
Kanıt kaydının ilk koşusu (sınıflayıcı 038add2: 97/100, 3 BULGU) aynı ölçülerle sınıflayıcının iki araç hatasını gösterdi ve düzeltildi: Tablodaki Kişiler'de 2.4.3'ün
"yalnız ilk sekme" kuralı (K-31a F4) hesaba katılmamıştı; Kasa satır özeti ölçüm anında sistemin yazdığı olayın kimliğini içeriyordu (aşağıda C9). Ürün değişmedi.

## BULGU G1 (ÜRÜN; göç değil — v2.4.3'te de var, 2.4.4'te daha ağır) — Silinenler'den geri yükleme dönem kilidini aşar
- Ne: kapanmış dönem tarihli silinmiş fatura Silinenler'den geri yüklenir (200; beklenen 409 — v2.0.13 dönem kilidi: kilitli tarihe hareket eklenemez/düzeltilemez/
  silinemez). Ardından Mutabakat Testi "Kapanmış dönem (…) kapının görmediği bir yolla değişti" der ve AYNI OTURUMDA: 2.4.3'te POS'lu / stoklu satış ve POS tahsilatı
  409 ledger-integrity ("yöneticinize bildirin"), POS valör kuyruğu sessizce aktaramaz; 2.4.4'te Kasa girişi ve peşin satış dahil 500 gate-equivalence. Program yeniden
  açılınca kilit izi yeniden alındığı için (server/lib/integrity.mjs:798-799) hata kaybolur ve sızıntı görünmez olur.
- Kök neden: `server/routes/trash.mjs:502` fatura kolu `restoreDate(issue_date)` çağırmaz (tahsilat :353, Kasa :405, taksit :460 kolları çağırır);
  `server/routes/invoices.mjs:3116` restoreDeleted'da kilit denetimi yok.
- Nasıl bulundu: aday 9 üretiminin 3. ve 4. denemesi v2.4.3'te 409 ledger-integrity ile düştü (`cikti/g1-ilk-ret.json`: 23.10 POS'lu stoklu satış). Aynı istek yeni
  süreçte iki sürümde 200 (yoklama) → süreç içi durum; aynı veride kilitli tarihli silinmiş belgenin geri yüklenmesi hatayı iki sürümde üretti.
- En kısa yeniden üretme (`yeniden-uret-g1`, 1/1): boş veri → bugün −40 günlük satış → sil → kilit bugün −30 → Silinenler'den geri yükle →
  v2.4.3: geri yükleme 200, Mutabakat Testi period-lock, Kasa 200, peşin satış 200; 2.4.4: geri yükleme 200, period-lock, Kasa 500, peşin satış 500.
- 2.4.3 verisindeki izi (göçle gelen): 001'de kilitli tarihli silinen 10 fatura; 1'i kilitten SONRA geri yüklenmiş (FIS2026000000196, 01.04.2026; 16.10.2026'da;
  "İptal Edildi", seq 0 — numarası canlı başka belgede); 2'si Silinenler'de bekliyor (FIS…199, FIS…215). Para izi yok (yalnız invoices + invoice_lines; cari, Kasa,
  mizan aynı). 2.4.4 göçten sonra görmez (Mutabakat Testi 0 sapma, açılış normal). Öneri: BİLİNEN SINIR (onarım kilitli döneme dokunmak olur). Düzeltme ayrı ajanda
  (is/g1-kilit); tatbikata C11k eklendi (kilitli tarihli silinmiş belge geri yüklenmez).

## C9 ilk koşuda kırmızı → ARAÇ (iki sürümde aynı; yeniden üretildi)
2.4.3 yedeği 001'e geri yüklenince ölçüm anında POS valör kuyruğu (server/lib/bank/pos.mjs:1500-1517 createPosQueue, sistem) 19.10'un bekleyen gün sonunu yeniden yazar;
yedekte yok (yedek alınırken bekliyordu — G1 yüzünden üretimde aktarılamamıştı). Olay sayaçları geri yüklemede geri gitmez (server/lib/company-backups.mjs:39-40
EVENT_COUNTERS / maxCounterSql, :143; v2.4.3'te :136) → aynı tutar/tarih/hesapla BNK-2026-001548 (göç ölçüsünde 001546). v2.4.3'te aynı adımlar aynı sonucu verir
(not defteri `probe-c9.mjs`). Araç düzeltmesi (625e9eb): yedek tatbikatı karşılaştırması sistemin yazdığı olayı numarasız (tür + tarih) okur; tutar, tarih, yol ve
rapor hücreleri aynen karşılaştırılır; öbür her olay numarası aynen. Göç farkı numaralı özeti kullanmaya devam eder.

## Tatbikat, geri dönüş, kesinti, zincir (aday 9 kodu; araç 24674b5 → 9058e98)
- tatbikat-buyuk 43/44: C1–C5, C6, C7, C8 (yeni tekrar yok; eski veride 2.4.3'ün geri yüklemesinden kalan aynı numara metinleri sayılmaz), C10 (30b: göçte uyarı yok;
  geri yüklemeden sonra yalnız o şirkette var, kapatılınca gider; 2.4.3 yedeğinde de), C2b (bırakılan kâğıt makbuz gönderilemez: 4xx, kart ve EDM değişmez), C11 (E6:
  002'de numarası canlı belgede olan silinmiş SMM…098 geri yüklenmez 409, Silinenler'de kalır; boştaki SMM…067 / …120 kendi numarasıyla döner; sıradaki numara
  değişmez) geçti. KIRMIZI C9 001 → ARAÇ (yukarıda), düzeltildi (625e9eb). C11k (G1) 587a4a4'te eklendi, henüz koşulmadı.
- donus-buyuk 6/6, kesinti-buyuk 79/79 (zorla 5 nokta: yedek yazıldı / v31 içinde / v31–v32 arası / v32 içinde (E6 taraması dahil) / disk dolu; gerçek süreç 8 gecikme;
  kilitli dosya — her denemeden sonra iki şirketin olguları göç ölçüsüyle aynı, numara tabanı aynı).
- zincir-v2026-fikstur 185/185 (fikstür 2.0.26, 4 şirket → v2.1.0 → v2.2.0 → v2.3.0 → v2.4.3 → 2.4.4; 177 olgu EŞİT 148, BELGELİ 29, BULGU 0; doğrudan = adım adım),
  zincir-v230-uretilen 104/104 (v2.3.0 gerçek koduyla üretilen veri, silme + Silinenler dahil → v2.4.0 … v2.4.3 → 2.4.4; 100 olgu EŞİT 61, BELGELİ 39, BULGU 0).
  İlk fikstür koşusu (24674b5) 4 BULGU verdi: MM8 sınıflayıcısı "Taksit iadesi"ni belge saydı → fatura olmayan iade ödemedir (9058e98), yeniden koşuldu.
- BEKLİYOR (ana oturum kararı): goc / fark / tatbikat / donus / kesinti aday 11'de (aday 10 + G1 düzeltmesi) yeniden koşulacak — C9 düzeltmesi ve C11k orada görülür.

## Kanıt kayıtları (bu klasör; tools/kanit.mjs kos)
| Kayıt | Hüküm | Commit |
|---|---|---|
| uret-v243-buyuk | GEÇTİ 6.207/6.207 | 6dc52d6 + araç (içerik 59bbd64) |
| olcu-v243-taban | GEÇTİ 2/2 | 24674b5 |
| goc-v243-244-buyuk | GEÇTİ 2/2 | 24674b5 |
| fark-v243-244-buyuk | GEÇTİ 100/100 (EŞİT 57, BELGELİ 43) | 24674b5 |
| tatbikat-buyuk | BAŞARISIZ 43/44 (C9 ARAÇ) | 24674b5 |
| donus-buyuk | GEÇTİ 6/6 | 24674b5 |
| kesinti-buyuk | GEÇTİ 79/79 | 24674b5 |
| uret-v230-kucuk | GEÇTİ 2.667/2.667 | 24674b5 |
| zincir-v2026-fikstur | GEÇTİ 185/185 | 9058e98 |
| zincir-v230-uretilen | GEÇTİ 104/104 | 9058e98 |
| kaynak-taramalari | GEÇTİ 67/67 | 9058e98 |
| yeniden-uret-g1 | GEÇTİ 1/1 (G1 iki sürümde yeniden üretildi) | 9058e98 |
Ham olgular not defterinde: `v2.4.3-taban.json` sha256 8c7d55015dce407e16ced0deb3411e167bfd2d6081b58cffe67bc8c8b9368bc7, `guncel-goc.json` sha256 de28026f34fb89d00f44bcfb6b46d09b1b3c348f27dba1c36b3fb5f83c39e53e.

## DENENEN / DENENMEYEN / BİLİNEN SINIRLAR
DENENEN (ders): 17 (v2.4.3 / v2.3.0 / 2.0.26 GERÇEK kodu ve verisi; yedek, geri yükleme, geri dönüş, zincir), 23 + 25 (eski kod git archive önbelleği, benzersiz
klasör), 13 + 22 (sahte saat, sabit an), 30 (HUKUK_LICENSE_URL=127.0.0.1:9), 20 (kesinti ön koşulları zorla), 3 (her ret sayıldı; 5 beklenen ret manifestte), 4 (Yevmiye
okunamazsa BULGU — ilk ayrıştırma 0 satır okuyordu, düzeltildi), 5 (yeni kurallar kararın metninden + eski verinin kayıtlarından), 6 (G1 ve C9 yeniden üretildi, eski
sürümle karşılaştırıldı, kök neden yazıldı), 24 (disk ≥ 18 GB), 36 (yalnız kendi süreçlerim). Test kuralı: aynı adlı kişi, sil + geri yükle, kilitli dönem, iki şirket.
DENENMEYEN: aday 11 koşusu (bekliyor); C11k; MM3 (veride stopajlı / tevkifatlı iade yok → Stopaj ve Tevkifat Özeti EŞİT); U1 (göç sonrası "Nihai Tüketici" seçimi;
veride adı belli 11111111111'li cari yok); E1/E4 (gönderim sırasında kesinti — göç dışı); UX17, E5, E7 (göç olgusunda değişmedi; ayrı denetlenmedi); U3 çıktı
dosyaları (PDF/Excel adı ve TOPLAM — yalnız Yevmiye Excel'i okundu); ekran (arayüz); gerçek Windows; tek tohum (7).
BİLİNEN SINIRLAR: (1) G1 sızıntısı eski veride kalır (iptal edilmiş, etkisiz; 2.4.4 görmez). (2) Geri yüklemeden sonra sistemin yeniden yazdığı olay yeni numara alır
(sayaç geri gitmez; iki sürümde de). (3) 2.4.3'te silinip geri yüklenen belgenin numara metni canlı belgeyle aynı kalır (001: 7, 002: 6 numara; göç düzeltmez).
(4) 2.4.3 Gönderilecekler'de iptal edilmiş numarasız e-Arşiv ve e-Belge durumu "none" olan alıştan iade gösterir (gözlem; 2.4.4'te Tümünü Gönder bunları göndermez).
