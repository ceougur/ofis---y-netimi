# P-Ç5C — Ödeme Hatırlatma'nın tek borç sırasına geçişi: plan raporu (2.5.1)

> Plan ajanı; KOD VE TEST YAZILMADI. Taban `t251-taban` (64396478). Kaynaklar: görev metni `docs/devir/2.5.1-DEVAM/pc5c-istem.txt`;
> kararlar `docs/2.5.0-IS-LISTESI.md` (C / D), `docs/GECMIS-KARARLAR.md` (31.10 – 01.11 WhatsApp kararları), `docs/erp/C5-ACILIS-TASARIM.md` §1.4, §2.10, §2.12, §8,
> `docs/erp/C5B-TYK-TASARIM.md` §1, §3, WhatsApp kâhininin `README.md`'si (yalnız belge; model kodu okunmadı), `docs/devir/D3-D4-TASARIM.md` (dal `claude/epic-thompson-w0lc2l`; tabanda yok).
> İlke taslağı (kullanıcı dili): `docs/devir/C5C-ILKE-TASLAK.md`.

## SONUÇ
Ödeme Hatırlatma bugün hâlâ yalnız taksit kartlarının (kartın kendi hesabıyla) gecikmişine bakıyor; şüpheli alacak, Ödeme Sözü, tedarikçi ve "bize alacaklı" elemeleri için verilmiş
kararların (S7 ailesi, S52 / S72 / S73, S93, karar (5)) HİÇBİRİ kodda yok. Programın kendi API'siyle kurulan 14 carilik denemede bugün seçilen 6 kişiden 4'ü kararlara aykırı (bakiyesi 0,
bize alacaklı, şüpheli, söz vermiş); tek borç sırasına geçince bu 4'ü çıkar, faturası / borç kaydı / kapatılmış kartı gecikmiş 3 kişi girer. Büyük veride (1.484 cari) küme aynı kalıyor
(848), iletideki toplam tutar 68,1 milyon TL'den 157,0 milyon TL'ye (2,3 kat) çıkıyor. "Kime kaç kez" ilke taslağı yazıldı: 30 satırlık "nasıl bozulur?" listesi, her madde KARARLI / İLKEYLE /
SORU; 10 soru TEK listede (en önemlileri: vadesiz faturanın ertesi gün hatırlatmaya girmesi, "elle seçim"in programda yolu olmaması, "Yine de Gönder"in donmuş tutarı S16 / S29 / S34 ile
çelişmesi). Önerilen sıra: kullanıcı onayı → iki kâhin bakımı (kodu görmeyen) → tek kod turu (müşteri istekleri tur 2'den sonra) → S260 ayrı küçük tur (seçilirse) → D6 en sonda.

## 1. BUGÜNKÜ DURUM (koddan; taban t251-taban)

### 1a. Otomatik seçim kimi alıyor
- "Otomatik seçim" programda ayrı bir zamanlayıcı DEĞİL: kullanıcı Cari Listesi'nde kutularla ya da süzgeçteki hepsini seçip "WhatsApp" der
  (`client/assets/hof-accounts.js:282-296` `bulkWhatsapp`), program seçilenleri sırayla eleme kurallarından geçirir (`server/lib/whatsapp/queue.mjs:419-432` `selection`,
  `:562-669` `plan`). "Otomatik liste" = elemelerden sonra kalanlar.
- Eleme sırası (`queue.mjs:542-550` `eligibility`): Cari Silinmiş → WhatsApp Mesajı İstemiyor → Pasif Cari → numara → (hatırlatmada) **Gecikmiş Borç Yok** → sonra
  `plan` içinde Zaten Kuyrukta → Sonucu Belirsiz → Daha Önce Gönderildi (R3).
- "Gecikmiş" ESKİ anlamda: `queue.mjs:145-150` `overdueOf` — `account.totals.overdue` (açık TAKSİT KARTLARININ kendi hesabıyla vadesi geçmiş taksitleri,
  `server/routes/accounts.mjs:226-228` yorumu, B1-W) > 0 VE en az bir AÇIK kartın sıradaki taksiti (`plan.next`, kalanı > 0) vadesi bugünden önce. İkisi birden yoksa elenir.
  Önizleme / açma cari okuması `routes/accounts.mjs:257-265` `waFacts` (detail ile aynı çekirdek; TYK alanları önbellekten eklenir ama WhatsApp onları OKUMAZ).
- Şüpheli alacak, Ödeme Sözü, cari türü (tedarikçi), net borç (karar (5)) — hiçbiri elemede YOK (S7, S7-a, S7-b, S16, S17, S22, S23, S29, S34, S52, S72, S73, S93 kararları
  KODLANMADI; 2.5.0 iş listesi D 22.11 06:32 "Ç5-C'nin kodu yok" ile aynı). WhatsApp kâhini S7 ailesini ve karar (5)'i MODELLİYOR (README §16–§21), Ödeme Sözü ve tedarikçiyi modellemiyor.

### 1b. İletideki {{3}} / {{4}} / {{5}}
- `queue.mjs:1790-1795` (`prepare`, ilk hazırlıkta): {{3}} = açık kartların sıradaki gecikmiş taksitlerinin EN ESKİ vadesi (`overdueOf().dueDate` — kart bazında `plan.next`, yani her
  kartın yalnız İLK ödenmemiş taksiti), {{4}} = `totals.overdue` (kartların kendi hesabıyla gecikmiş taksit toplamı), {{5}} = `totals.balance` (cari bakiyesi; "… (Alacaklı)" biçimi).
- Fatura / Borç Yaz / açılış / karşılıksız evrak gecikmişi {{4}}'e girmez; carinin taksit kartı dışında tahsilatı kart taksitini kapatmışsa (S50 kuyruğu) {{4}} bunu görmez.

### 1c. Elle seçim
- Kişi başına "yine de ekle" düğmesi YOK. Cari kartından tek cari seçmek (`hof-whatsapp.js:418`) de toplu seçimle aynı elemeden geçer. S7 / S16 "elle seçim" kavramının programda
  karşılığı yok (kâhinde `baslat.supheli_elle` — README §17.2 Y12-3).

### 1d. Önizleme, Zaten Kuyrukta, dönem eşliği, Sonucu Belirsiz, Yine de Gönder
- Önizleme (`queue.mjs:703` `preview`) ve açma (`:781` `createBatch`) aynı `plan()`; ekranda "Elenenler ve Nedenleri" + kişi listesi (`hof-whatsapp-api.js:166-183`). Etiket ("Ödeme Sözü Var",
  "Şüpheli Alacağı Var") önizlemede YOK.
- Hatırlatmanın dönemi: R3 "Daha Önce Gönderildi" anahtarı gönderim GÜNÜ (aynı gün ikinci hatırlatma sorulur, ertesi gün serbest — `donem.mjs:15-16` BAŞ MİMAR KARARI GRUP 5 ★5);
  "Zaten Kuyrukta" günsüz (süren hatırlatma işi varken yenisi elenir).
- Sonucu Belirsiz → yeni toplu işte elenir (iş dosyadaysa; 31.10 kararları); "Yine de Gönder" (`queue.mjs:941-954` `sendAnyway`) yeni iş açar ve KAYNAĞIN DONMUŞ İÇERİĞİNİ DEVRALIR
  (`:928-939` `inheritContent`, T1 P6 BAŞ MİMAR KARARI "aynı ileti") → hatırlatmada {{4}} basma anındaki değil, kaynağın ilk hazırlandığı andaki tutar. Bu, S16 / S29 / S34'ün
  "şüphesiz / gönderim anındaki tutarla gider" metniyle ÇELİŞİR (bkz. §3 S-C5C-7).
- Başarısızları Yeniden Dene (`:913-926`) yeni iş; içerik gönderim anında yeniden hazırlanır (hatırlatmada PDF yok; S37 = B).

### 1e. Gönderim anında yeniden değerlendirme
- `queue.mjs:1588-1601`: işçi cariyi TAM kartla (`accounts().detail`) okur, `eligibility` YENİDEN koşar (silinmiş / İstemiyor / pasif / numara / Gecikmiş Borç Yok → "Atlandı").
  `prepare` (`:1773-1774`) her denemede Gecikmiş Borç Yok'u yeniden denetler; içerik (params) ilk hazırlıkta DONAR (`:1776-1779`) — Meta Bekletti 2. denemesi, 131056 / geçici hata
  yeniden denemesi donmuş tutarla gider ("Gittiği anki içerik", 01.11 10:40).
- Kuyruktayken borç TAMAMEN ödenirse → "Atlandı — Gecikmiş Borç Yok" (eski alanla). Kısmen ödenirse → ilk hazırlıkta güncel, sonra donmuş.
- Kuyruktayken şüpheli kaydı açılırsa → bugün HİÇBİR şey olmaz (ileti gider; S7-b / S22 kodlanmadı). Ödeme Sözü verilirse → gider. Cari silinirse → "Atlandı — Cari Silinmiş".
  Türü tedarikçi yapılırsa → gider (tür okunmaz).

### 1f. Ekrandaki etiketler
- Cari kartı: "Gecikmiş Borç · N kalem · Ödeme Sözü Var (gg.aa.yyyy)" (`hof-accounts.js:400`; TYK). Cari listesi: `promiseUntil`, `doubtfulOpen` (`routes/accounts.mjs:457-461`),
  Şüpheli Alacak rozeti (`hof-accounts.js:1177`). "Şüpheli Alacağı Var" metni programda YOK (yalnız `queue.mjs:2425` yorumunda).
- WhatsApp önizlemesinde ve Gönderimler ekranında etiket yok; eleme adları: "Gecikmiş Borç Yok" (tek ad).

### 1g. Aynı sayıyı (eski anlamdaki taksit gecikmişini) okuyan öbür yerler
| Yer | Bugün | Not |
|---|---|---|
| Ödeme Hatırlatma (önizleme / açma / gönderim anı / {{3}} {{4}}) | eski (`totals.overdue`, `plan.next`) | Ç5-C'nin konusu |
| Elle (wa.me) WhatsApp "Geciken Taksit" şablonu `{Vadesi Geçen}` = "N taksit (TL)" | eski (`routes/whatsapp.mjs:140`, `hof-whatsapp.js:27, :40`) | ileti metni; eleme yok — Ç5-C'ye girmeli (öneri, §4) |
| Elle ekstre metni "Vadesi geçen: N taksit, TL" | eski (`routes/whatsapp.mjs:83`) | aynı |
| Mevcut Borç kartı açma sınırı "taksitlendirilebilecek borç" | kartın KENDİ hesabı (`routes/plans.mjs:676-688` `uncoveredDebt`, :871-873) | S260 = B (BİLİNEN SINIR; "2.5.1'de Ç5-C ile") |
| Cari kartı "Gecikmiş Borç", cari listesi, süzgeç, Anlık Durum, mobil özet, Vade Takip | TYK (Ç5-B) | değişmez |
| Cari kartının taksit özeti (Ödenen / Kalan / Durum / sıradaki) | TYK görünümü (S129, S142 — `routes/accounts.mjs:212-219` `shownOf`) | B1-W'nin "taksit özeti → Ç5-C" maddesi birleşik tur 8'de KARŞILANMIŞ görünüyor; kalan tek eski okuyucu WhatsApp'ın `plan.next`'i |
| Rapor Merkezi Cari Listesi "Geciken" kolonu + "Geciken taksiti olan" süzgeci | sayı TYK, AD eski (`report-center.mjs:62`, `:1789`; `overview.mjs:282`) | ad değişikliği B1-W'de "sonraki Ç3 turuna" verilmişti → müşteri isteğinin Rapor Merkezi turuna (öneri, §4) |
| Taksit Kartları raporu "Geciken" (`report-center.mjs:2341-2344`) | kart görünümü | taksit raporu; değişmez |

### 1h. Tek borç sırasının (TYK) bugün verdiği alanlar
| Gereken | Alan | Durum |
|---|---|---|
| Gecikmiş (şüpheli hariç, net) | `totals.overdueDebt` (`tyk.overdue(gün).amount`; `obligation-queue.mjs:1256-1260`: alacak yönlü, vade < gün, kalan − şüpheli payı) | HAZIR (önizleme önbellekten, gönderim anı tam karttan) |
| En eski gecikmiş açık kalem vadesi | `totals.overdueSince` (`overdue.since` = gecikmiş kalemlerin en küçük vadesi) | HAZIR |
| Şüphesiz gecikmiş + "şüpheli kalemler hariç net borç" sınırı (S17) | aynı alan: şüpheli payı kalemden düşülmüş; G1 net görünümde Σ açık borç = bakiye → sınır kendiliğinden | HAZIR (değişmez EK-1 §4; testle gösterilmeli) |
| Şüpheli kaydı açık mı | `totals.doubtfulQueue` (kuyruğa alınan tutar) waFacts'te VAR; kaydın kendisi (`doubtfulOpen`, Şüpheli Alacaklar kalanı) yalnız listede ve tam kartta | KISMEN — waFacts'e toplu okuma gerekir (ders 47) |
| Ödeme Sözü | `totals.promiseUntil` / `promiseActive` (söz ≥ bugün ve gecikmiş > 0; S72 söz günü dahil, S73 bütün borç) | HAZIR |
| Cari türü | `account.type` (customer / supplier / other) | HAZIR (okunmuyor) |
| Kalem türü (fatura / taksit / Borç Yaz / açılış / kapalı kart) | `tyk.items[].kind / planId / invoiceId / origin / lineKind` | HAZIR (yalnız iç; ekranda gösterilmiyor) |
| Gecikmiş kalem SAYISI | `overdueDebtCount` | HAZIR (ileti şablonunda yer yok) |

## 2. FARK TABLOSU

Kanıt: betikler `pc5c-senaryo-betik.mjs` (küçük senaryo, programın API'siyle; boş veri, sahte saat 08.10.2026 durur), `pc5c-fark-betik.mjs` + `pc5c-siniflar.py` (büyük veri);
ham çıktılar `pc5c-senaryo-cikti.json`, `pc5c-fark-cikti.txt` (bu klasörde). "Bugün" sütunu `queue.mjs` `overdueOf` + `eligibility`'nin birebir okumasıyla (aynı alanlar), "sonra" tek borç
sırasının `overdue(bugün)`'ü + şüpheli kaydı + Ödeme Sözü + tür, taslaktaki öneri sırasıyla. Program kodu değişmedi; ikisi de `flock -s olcum.lock` altında, yük 5–7 (sayıları etkilemez; süreleri
geçersiz kılar).

### 2a. Küçük senaryo — her sınıf bir cari (programın API'siyle kuruldu)
| Cari | Sınıf | Bugün gider mi · {{4}} ({{3}}) | Sonra gider mi · {{4}} ({{3}}) | Karar |
|---|---|---|---|---|
| K1 | yalnız taksit (kart 900 = 3 × 300, ilk vade 05.09) | evet · 600 (05.09) | evet · 600 (05.09) | aynı |
| K2 | yalnız vadeli fatura 900 (vade 20.09) | **hayır** | **evet** · 900 (20.09) | 1.1 |
| K3 | yalnız Borç Yaz 500 (vade 15.09) | **hayır** | **evet** · 500 (15.09) | 1.1 |
| K4 | kapatılmış kart, Borçta Kalsın (S220) | **hayır** | **evet** · 600 (05.09) | 3.3 S220 |
| K5 | kart gecikmiş ama karta bağlanmadan tahsilat 900 → bakiye 0 | **EVET · 600 — bakiyesi 0 iken** | hayır (Gecikmiş Borç Yok) | 2.4 (5) |
| K6 | tedarikçiye avans 1.000 (kart "Gecikmiş Borç" 1.000) | hayır | hayır (Tedarikçi) | 2.1 S93 |
| K7 | şüpheli: kart 600 gecikmiş, 300 Şüpheli Alacağa Alındı | **EVET · 600 (şüpheli dahil)** | otomatik hayır (Şüpheli Alacağı Var); elle · 300 (05.10) | 2.2 S7, 3.4 S17 |
| K8 | kart 600 + Borç Yaz 400, Ödeme Sözü 20.10 | **EVET · 600** | otomatik hayır (Ödeme Sözü Var); elle · 1.000 (05.09) | 2.3 S52 / S73 |
| K9 | Diğer türü, Borç Yaz 300 (vade 15.09) | hayır | **S-C5C-2:** A evet · 300 / B hayır | SORU |
| K10 | dün (07.10) kesilmiş VADESİZ fatura 750 | hayır | **S-C5C-1:** A evet · 750 (07.10) / B hayır | SORU |
| K11 | kart 600 gecikmiş + Alacak Yaz 1.000 → bakiye 100 alacaklı | **EVET · 600, {{5}} "100,00 TL (Alacaklı)"** | hayır (Gecikmiş Borç Yok) | 2.4 (5) |
| K12 | taksit 600 + vadeli fatura 500 (vade 30.08) | evet · 600 (05.09) | evet · **1.100 (30.08)** | 3.1, 3.2 |
| K13 | Ödeme Sözü BUGÜN (08.10) | hayır | hayır (Ödeme Sözü Var) | S72 |
| K14 | vadesi BUGÜN olan fatura 600 | hayır | hayır | 1.2 M1f |
ÖZET: bugün 6 cari seçiliyor (K1, K5, K7, K8, K11, K12) — **bunların 4'ü kararlara aykırı** (bakiyesi 0, bize alacaklı, şüpheli, söz vermiş). Sonra otomatik 5 cari (K1, K2, K3, K4, K12)
+ yanıta göre K9 / K10 → 5–7. **Çıkan 4, giren 3–5; tutarı değişen 1 (K12: 600 → 1.100).** Kart ekranındaki "Gecikmiş Borç" ile hatırlatma {{4}} sonra HER caride aynı (değişmez §2.10 9).

### 2b. Büyük veri (programın kendi ürettiği temiz-100k kopyası; 1. şirket 1.484 cari, 82 bin para satırı, 34 bin fatura, bugün 08.10.2026)
- Telefonu geçersiz 212 → değerlendirilen 1.272 cari (1.060 müşteri, 318 tedarikçi, 106 diğer arasından).
- BUGÜN seçilen: **848 cari · 68.129.872,75 TL**. SONRA: **848 cari · 156.993.991,79 TL** — küme AYNI (bu veride gecikmiş borcu olan her müşterinin gecikmiş taksiti de var; "yalnız fatura" /
  "yalnız Borç Yaz" sınıfı bu veride oluşmuyor), toplam tutar **2,3 kat**: 742 caride artıyor (+95.449.148,56), 106 caride azalıyor (−6.585.029,52; kart taksidi carinin bağsız tahsilatıyla
  kuyrukta kapanmış — S50), {{3}} 848'inin hepsinde değişiyor (424'ünde daha eski tarih).
- Gecikmiş kalemlerin türü (cari sayısı): taksit 848, fatura 742, stok satışı borcu 742, Borç Yaz 636, müşteriye yapılan ödeme (iade / avans) 424.
- Bu veride şüpheli kaydı açık cari 0, Ödeme Sözü süren 0, tedarikçi / Diğer'de gecikmiş 0 → bu sınıflar büyük veride DENENEMEDİ (§8); kod turunda programın kendi ürettiği çok sınıflı veri gerekir.
- KULLANICIYA GÖSTERİLECEK ANA SAYI: alıcı kümesi bu veride büyümüyor ama TUTAR 2,3 katına çıkıyor; tipik bir veride (2a) aykırı 4 kişi çıkıyor, faturası / borç kaydı / kapalı kartı
  gecikmiş 3 kişi giriyor (vadesiz fatura ve Diğer türü yanıta göre +2).

## 3. İLKE TASLAĞI

`docs/devir/C5C-ILKE-TASLAK.md` (kullanıcı dilinde; 30 satırlık "nasıl bozulur?" listesi önce, her satır bir maddeye bağlı; her madde KARARLI / İLKEYLE / YENİ — SORU / ÖNERİ UYGULANIR).
Soruların tam metni taslağın §10'unda; aşağıda raporun KULLANICIYA SORULMALI bölümü aynı numaralarla.

### 3a. KULLANICIYA SORULMALI (para / kime kaç kez — ders 43, 45; 5 dk yetkisi YOK; tam metin ve örnekler taslak §10)
1. **S-C5C-1 vadesiz borç (kör nokta):** vadesi yazılmamış fatura / Borç Yaz ertesi gün gecikmiş (S1) → hatırlatmaya da girsin mi? A (öneri) evet / B yalnız vadesi yazılmış kalem.
   Sayı: 07.10'da kesilen vadesiz 750 TL'lik fatura → A ile 08.10'da hatırlatma gider.
2. **S-C5C-2 Diğer türü:** A (öneri) gider / B yalnız Müşteri. Sayı: Diğer türlü 300 TL gecikmişli cari (büyük veride 0).
3. **S-C5C-3 tedarikçi elle:** A (öneri) hiçbir yoldan gitmez (yol Ekstre) / B elle seçilirse gider. Sayı: 1.000 TL avanslı tedarikçi.
4. **S-C5C-4 S260 (taksitlendirme sınırı):** A (öneri) 2.5.1'de tek borç sırasından, ayrı küçük tur / B bugünkü gibi / C uç durum böyle kalsın. Sayı: S260 örneği 300 → 600.
5. **S-C5C-5 kuyruktayken söz:** A (öneri) gönderim anında "Atlandı — Ödeme Sözü Var" / B başlatmadaki seçimle gider.
6. **S-C5C-6 kuyruktayken tedarikçi (uç):** A (öneri) "Atlandı — Tedarikçi" / B gider / C uç durum böyle kalsın.
7. **S-C5C-7 elle seçimin yolu:** A (öneri) önizlemede etiketli kişiye "Yine de Ekle" / B yalnız cari kartından tek cari. Sayı: 14 carilik denemede etiketli 2 kişi (300 TL, 1.000 TL).
8. **S-C5C-8 Yine de Gönder tutarı:** A (öneri) gönderim anındaki güncel tutar / B donmuş tutar (şüphelide güncel). Sayı: 1.000 TL belirsiz, 400 ödendi → A 600 / B 1.000.
9. **S-C5C-9 devir anında süren gönderim:** A (öneri) "Durduruldu (Devir)", gönderilmeyenler almamış sayılır / B gönderim bitmeden devir başlamaz.
10. **S-C5C-10 elle şüpheli caride {{5}} (uç):** A (öneri) bütün bakiye / B şüpheli hariç / C uç durum böyle kalsın. Sayı: bakiye 900, şüpheli 300 → A 900 / B 600 ({{4}} iki okumada 300).


## 4. BAŞ MİMAR KARARI GEREKİYOR (mimari; soru değil — ders 40 gereği kullanıcıya gösterilir)
- **B-1 İki kâhinin iş bölümü (bağımsızlık, ders 5).** Hatırlatmanın KİME / HANGİ TUTAR'ı muhasebe (cari) kâhininde ZATEN modelli: sürücü `test/bagimsiz/muhasebe-surucu/karsilastir.py:822-833`
  "hatirlatma" raporunu `otomatik` (cari → tutar), `supheli_etiketli`, `elle` alanlarıyla karşılaştırıyor ve bugün `{"Ç5-C"}` kimliğiyle "uygulanmadı" (U) sayıyor; Ödeme Sözü olayı sürücüde
  "uygulanmadı — Ç5-C" (`program.mjs:1215-1218`: kâhinin söz CARİ düzeyinde, programın söz HAREKET düzeyinde — eşleme yok). KAÇ KEZ / DÖNEM / Yine de Gönder WhatsApp kâhininde.
  ÖNERİ: (a) tutar ve küme muhasebe kâhiniyle (sürücünün Ç5-C satırları kapanır; söz eşlemesi sürücüye — "kâhinin carisi düzeyindeki söz → programda o carinin bütün açık borç
  kalemlerine Beklenen Ödeme Tarihi" ya da S73 "bütün borcu kapsar" gereği tek kaleme yazmak yeter; kâhin bakımında teyit), (b) kime kaç kez WhatsApp kâhiniyle (kalemler senaryodan), (c) ikisinin
  arasını program içi DEĞİŞMEZ testi bağlar: her cari için önizlemenin {{4}} / {{3}}'ü = cari kartının Gecikmiş Borç / en eski vadesi (§2.10 9. değişmez). WhatsApp kâhinine tek borç
  sırasını yeniden yazdırmak önerilmez (iki kâhin aynı kuralı iki kez taşır — Canlı Hata 2 dersi).
- **B-2 "Şüpheli kaydı açık" tanımı.** Program iki sayı taşıyor: Şüpheli Alacaklar'daki kaydın kalanı (listede `doubtfulOpen`) ve tek borç sırasının şüpheliye ayırdığı pay (`doubtfulQueue`).
  ÖNERİ: S7'nin metni ("şüpheli alacak kaydı … açık") gereği KAYIT KALANI > 0. Fark yalnız borcu kalmamış kayıtlı caride doğar; o kişi zaten "Gecikmiş Borç Yok" ile elenir (yalnız neden
  adı farklı) → kime kaç kez etkisi yok.
- **B-3 Önizlemenin şüpheli bilgisi toplu okunur (ders 47).** `waFacts` bugün kayıt kalanını okumuyor; kişi başı `doubtful().summary` yerine plan() başında TEK toplu okuma
  (`lib/bank/doubtful.mjs` `openByAccount` — listenin kullandığı kaynak).
- **B-4 Eski alanın akıbeti.** `totals.overdue` (eski anlam) kartın kendi hesabını okuyan iç yollarda ve çok sayıda testte (`grep -rln "totals.overdue\|totals?.overdue" server client test`: 14 sunucu /
  istemci, 25+ test dosyası; çoğu KART toplamı) yaşıyor. ÖNERİ: alanın anlamı DEĞİŞMEZ; WhatsApp ve elle yol (`routes/whatsapp.mjs:83, :140`, `hof-whatsapp.js:40`) yeni alanlara
  (`overdueDebt`, `overdueDebtCount`, `overdueSince`, `promiseUntil` / `promiseActive`) geçer; `test/whatsapp-onizleme-olcek-248.test.mjs`'in eleme alanları listesi yeni alanlarla güncellenir
  (komşu — ders 10). Alanı yeniden adlandırmak ayrı iş (SONRAKİ SÜRÜME).
- **B-5 Elle seçim izi (S-C5C-7 = A ise).** İşe "elle" işareti yazılır → şirket dosyasında yeni sütun (GÖÇ). Göç numarasını ana oturum dağıtır (D4a da göç yazacak). Geri yükleme / taşıma:
  işaret işle birlikte gider (ilke 5); eski yedekten dönen işte işaret yok = elle değil (güvenli yön: ileti gitmez, yol yeniden seçim).
- **B-6 Gönderim anının cari okuması.** İşçi bugün tam kartı (`detail`, kuyruğu cari başına bir kez kurar) okuyor — doğru yön (önbellek bayatlığı yok). Değiştirilmez; yalnız yeni neden
  denetimleri (tür, şüpheli kaydı, söz) aynı okumadan.

## 5. PLANIN ESKİYEN YERLERİ
- `docs/erp/C5-ACILIS-TASARIM.md` §1.4 WhatsApp satırının dosya:satırları (queue.mjs:140-145, :524, :1393, :1411; routes/accounts.mjs:212; whatsapp.mjs:137) → bugün queue.mjs:145-150, :548, :1597,
  :1774 / :1793; accounts.mjs:257-265 (`waFacts`); whatsapp.mjs:140. §2.12'nin kuralları geçerli; "{{5}} = bakiye" aynen.
- `docs/erp/C5B-TYK-TASARIM.md` §3 madde 11 ("queue.mjs:146 … DOKUNULMAZ; eski alan korunur (Ç5-C)") → Ç5-C ile kalkar.
- 2.5.0 iş listesi D 06.11 19:26 B1-W: "cari kartının taksit özeti → Ç5-C" — birleşik tur 8'in S129 / S142 işleriyle taksit özetinin görünen sayıları ZATEN kuyruktan (§1g); Ç5-C'ye kalan yalnız
  WhatsApp'ın `plan.next` okuması. "RAPOR MERKEZİ 'Geciken' kolonu ve 'Geciken Taksiti Olan' süzgeci … sonraki Ç3 turuna": sayı TYK'ye geçmiş, AD eski kalmış ("Geciken taksiti olan") →
  müşteri isteğinin Rapor Merkezi turuna (öneri; Ç5-C değil).
- 2.5.1 plan taslağı §2 Ç5-C satırı S260'ı Ç5-C'nin içinde sayıyor → öneri: ayrı küçük tur (S-C5C-4; başka dosya, başka kâhin).
- `docs/devir/D3-D4-TASARIM.md` §6.3 "D6 (Ç5-C'den SONRA ya da aynı ajanda)" → öneri: aynı ajanda DEĞİL (D6 D4b'nin Geri Al yoluna bağlı; Ç5-C ondan önce birleşebilir).
- 2.5.0 teslim notunun "Ödeme Hatırlatma eski 'gecikmiş' anlamında" BİLİNEN SINIRI 2.5.1'de kalkar → sürüm notu + kılavuza tek satır (kılavuzda bugün "kime gider" cümlesi YOK; 2.4.8'de
  planlanan B1 notu da girmemiş — `docs/kilavuz/DestekOfis-Kullanim-Kilavuzu.html` WhatsApp bölümü :439-454).

## 6. ÖNERİLEN PAKETLEME VE SIRA

### 6a. Sıra
1. **P-0 Kullanıcı onayı** — `docs/devir/C5C-ILKE-TASLAK.md` §10'daki 10 soru TEK iletide (turun SON iletisinde; ders 43, 45 — 5 dk yetkisi YOK, "önerilerini uygula" kuralı bu sorularda
   UYGULANMAZ çünkü hepsi kime / kaç kez ya da para görünümü; yalnız taslakta "ÖNERİ UYGULANIR" diye işaretli görünüm maddeleri öneriyle sürer). Yanıtlar iş listesi D'ye AYNEN.
2. **P-1 Kâhin bakımları (kodu görmeyen, yeni ajanlar, high) — KODDAN ÖNCE** ("kâhin önce", 23.10):
   - WhatsApp kâhini bakımı (WK 21) — §7'deki girdi listesi (kime kaç kez, gönderim anı, Yine de Gönder içeriği, elle seçim, eleme sırası).
   - Muhasebe (cari) kâhini "hatirlatma" raporunun tutar / küme kuralları (§7 madde 1–2, 4, 7) — bakımı ayrı ajan değil, TOPLU KÂHİN BAKIMI kuralıyla kâhinin bir sonraki bakımına (o sırada
     M2 Değersiz sınırı / devir bakımı sürüyorsa onlarla aynı bakımda) eklenir; sürücünün `{"Ç5-C"}` "uygulanmadı" satırları ancak kod turu birleşince kapanır.
3. **P-2 Kod turu Ç5-C (tek ajan, high)** — dosya sınırı §6b; kabul §6c. Başlama koşulu: P-1 bitti + müşteri istekleri tur 2 ana dala girdi (`routes/accounts.mjs` çakışması).
4. **P-3 S260 (yalnız S-C5C-4 = A ise; ayrı küçük tur, high)** — `server/routes/plans.mjs` (`uncoveredDebt`), cari kâhini satırı; Ç5-C ile PARALEL olabilir (dosya ayrı). B / C ise iş yok.
5. **D6 (WhatsApp ilke 5 — devir)** Ç5-C'den SONRA ve D4b'den (Geri Al yolu) SONRA; aynı ajanda DEĞİL (D3-D4 §6.3'ün "ya da aynı ajanda"sı önerilmez: D4b kritik yolda, Ç5-C beklemesin).
   S-C5C-9'un yanıtı D4b'nin görev metnine (devir başlarken süren toplu iş) girer; Ç5-C kod turu devir koduna DOKUNMAZ.

### 6b. Kod turunun dosya sınırı
| Dosya | Ne | Çakışan 2.5.1 işi |
|---|---|---|
| `server/lib/whatsapp/queue.mjs` | `overdueOf` → tek borç sırası (`overdueDebt`, `overdueSince`); `eligibility` yeni nedenler (Tedarikçi, Şüpheli Alacağı Var, Ödeme Sözü Var) ve sıra (taslak 2.5); elle seçim izi; `prepare` {{3}}/{{4}}/{{5}}; `inheritContent` hatırlatma dalı (S-C5C-8) | D6 (aynı dosya, Geri Al) → Ç5-C ÖNCE; K4 WhatsApp küçükleri (olası) → aynı dalgaya konmaz |
| `server/routes/accounts.mjs` | yalnız `waFacts` (şüpheli kayıt kalanı toplu — B-3; tür zaten var) | müşteri istekleri tur 2 (cari listesi) → onlardan SONRA |
| `server/routes/whatsapp.mjs` | elle (wa.me) metni / ekstre satırı yeni alanlardan (taslak 3.5) | — |
| `client/assets/hof-whatsapp-api.js` | önizlemede etiketler + "Yine de Ekle" (S-C5C-7 = A) + güncelleme bilgi satırı (7.2); yazım düzeni | K4 (olası) |
| `client/assets/hof-whatsapp.js` | "Gecikmiş Borç" şablon adı ve `{Vadesi Geçen}` | — |
| `server/lib/migrations.mjs` | YALNIZ S-C5C-7 = A ise elle izi sütunu (B-5); numarayı ana oturum verir | D4a, M1 KDV, M2 Değersiz (göç numaraları) |
| `test/bagimsiz/whatsapp-248/surucu.mjs`, `test/bagimsiz/muhasebe-surucu/program.mjs` / `karsilastir.py` | YALNIZ sürücü eşlemeleri (söz, tür, elle); kâhin dosyalarına DOKUNULMAZ | Ç6 öncesi / devir sürücü işleri (sürücü dosyası ÇAKIŞIR — D3-D4 §6.2) → birleşim sırası ana oturumda |
| `test/whatsapp-c5c-*.test.mjs` (yeni), `test/whatsapp-onizleme-olcek-248.test.mjs` (eleme alanları — B-4), `test/e2e/senaryo-whatsapp-gonder-248.mjs`, `senaryo-is-akisi-248.mjs` (beklenti değişirse koşulur — ders 28) | testler | — |
| `docs/kilavuz/DestekOfis-Kullanim-Kilavuzu.html` + PDF (ders 42) | WhatsApp bölümüne tek satır: kime gider, etiketler, Yine de Ekle | D5 kılavuzu (aynı dosya; farklı bölüm) |
OKUR, DOKUNMAZ: `server/lib/obligation-queue.mjs`, `obligation-input.mjs`, `routes/invoices.mjs`, `lib/bank/doubtful.mjs`, `routes/plans.mjs` (S260 ayrı turda).
NOT (M2 Değersiz sınırı): değersiz yazılan kısım tek borç sırasından düşer → hatırlatma tutarı da düşer (kendiliğinden). Ç5-C'nin fark tablosu ve hız ölçümü M2 ana dala girdikten SONRA
yeniden okunur (aynı veri kopyasıyla).

### 6c. Test planı ("nasıl bozulur?" → test; taslak §0'ın N1–N30'u)
- **Sınıf testi (ders 53 (b), KALICI):** taslak 2a'nın 14 sınıfı × (bugün / yeni) programın API'siyle; her caride önizlemenin nedeni + {{3}}/{{4}}/{{5}} = cari kartının Gecikmiş Borç / en eski
  vade / bakiye (DEĞİŞMEZ, §2.10 9). Eski sürüm karşılaştırması: aynı betik `v2.5.0` etiketinin `git worktree add --detach` kopyasında (ders 23, 54) → farklar YALNIZ karar numaralı sınıflarda
  (1.1, 2.1–2.4, 3.1–3.3); numarasız fark birleşmez.
- **Gönderim anı (N12–N15, N30) — zorla (ders 20):** sahte Meta + elle işçi (`manual: true`); kuyruktaki işe arada tam / kısmi ödeme, söz, şüpheli kaydı, tür değişimi, silme, gece yarısı
  (sahte saat 23:59 → 00:01; ders 13, 22) → Atlandı nedeni, POST sayısı, iletideki tutar. İki saat diliminde (TZ=UTC ve Europe/Istanbul).
- **Yine de Gönder (N16):** sahte Meta yanıtsız → Sonucu Belirsiz; arada kısmi ödeme; Yine de Gönder → S-C5C-8'in yanıtındaki tutar; şüpheli kaydı açıkken S16 / S23 / S29 / S34 satırları.
- **Elle seçim (N17, N28):** önizleme → "Yine de Ekle" → başlatma → iş üzerinde iz; Devam Et ve aynı işin yeniden denemesi izi taşır; Başarısızları Yeniden Dene TOPLU (elle değil — kâhin Y12-8).
  Ekranda insan hızı + klavye (ders 12), yazım düzeni (Her Sözcük Büyük — "Yine de Ekle", "Ödeme Sözü Var").
- **Sürüm geçişi (N18–N20):** v2.5.0 gerçek koduyla hatırlatma gönder (sahte Meta) → aynı veri dosyası ve makine defteriyle 2.5.1 → aynı gün "Daha Önce Gönderildi"; kuyrukta bırakılan 2.5.0 işi
  2.5.1 işçisinde yeni kuralla.
- **Geri yükleme / taşıma (N22):** bugünkü 2.4.8 testleri AYNEN yeşil + tutar geri yüklenen dosyadan. Devir / Geri Al / arşiv (N21, N23, N24) → D6 paketinde.
- **İki şirket (N25):** 001 / 002 aynı kişi, aynı WABA → iki ileti, sınır ortak (bugünkü kâhin senaryoları yeşil kalmalı).
- **Eski kod kırmızısı (ders 7, 38):** her yeni test `t251-taban`'da BEKLENEN nedenle kırmızı (ör. K5 / K11 bugün 600 TL gönderir; K2 / K3 / K4 bugün elenir).
- **Mutasyon:** eleme sırası, söz günü dahil / hariç, tür okunmaz, Diğer, şüpheli kayıt ↔ kuyruk payı, elle izi tedarikçiyi geçirir, gönderim anında söz denetlenmez, Yine de Gönder donmuş tutar.
- **Komşular (ders 10):** `totals.overdue` / `plan.next` okuyucuları (`grep -rn "totals.overdue\|totals?.overdue\|overdueOf" server client test`), muhasebe sürücüsünün hatırlatma raporu, kâhin ↔ program
  (`npm run test:kahin-cari`, WhatsApp sürücüsü) iki TZ.

### 6d. Hız bütçesi (ders 47, 53 (a))
- Bütçe: 2.000 carilik önizleme ≤ 2 sn (WhatsApp planı; 2.4.8 İş Z kökü). Ç5-C cari başına ek ağır okuma GETİRMEZ: gecikmiş / en eski vade / söz / tür `waFacts`'te zaten var (tek borç sırası
  bütün carilerin önbelleğinden); tek ek şüpheli kayıt kalanı → plan() başında TEK toplu okuma (B-3). Gönderim anı: bugünkü gibi cari başına tam kart (iş başına bir kez; değişmez).
- Bugünkü ölçüm (bu ajan; GEÇERSİZ — yük 6,7–7,3, paylaşılan kilit, ders 52): 1.484 cari için `waFacts` döngüsü 3.360 ms + tek borç sırası önbelleğinin ilk kurulumu 988 ms (HTTP, dönem
  anahtarları ve makine defteri sorguları HARİÇ). Bu, bütçenin BUGÜN de aşılıyor olabileceğini gösterir; Ç5-C'den bağımsız bir kuşku → ana oturumun özel kilitli ölçümü
  (`betik/kabul.sh`'ye önizleme satırı; yük ≤ 2) Ç5-C'den ÖNCE ve SONRA aynı veri kopyasıyla. Kötüleşen birleşmez; önceden aşılıyorsa BİLİNEN SINIR mı, hız işi mi — kullanıcıya (11.10 kararı
  "bütçeyi az aşanlar BİLİNEN SINIR").

### 6e. Cari kartının taksit özeti ve S260 bu pakete girer mi
- **Taksit özeti: GİRMEZ** — görünen sayıları birleşik tur 8'de (S129, S142) zaten tek borç sırasından; kalan tek eski okuyucu WhatsApp'ın `plan.next`'i Ç5-C'nin kendi işi (§1g). Gerekçe: dosya
  sınırını küçük tutar, kanıtı olan işi yeniden açmaz.
- **S260: GİRMEZ** (öneri; S-C5C-4) — farklı dosya (`routes/plans.mjs`), farklı kâhin (cari), para / taksitlendirme kuralı; WhatsApp'ın kime / kaç kezine dokunmaz. A seçilirse ayrı küçük tur
  (P-3), Ç5-C ile paralel.

## 7. WHATSAPP KÂHİNİ BAKIMINA GİRDİ LİSTESİ (kural dilinde; ana oturum karar girdisine çevirir — kâhine iş listesi verilmez, ders 5)

Kâhin bugün S7 ailesini (S7, S7-a, S7-b, S16, S17, S22, S23, S29, S34) ve karar (5)'i modelliyor (README §16–§21); aşağıdakiler YENİ ya da DEĞİŞEN kural (kullanıcı yanıtlarıyla kesinleşir; yanıtsız madde kâhine girmez — ders 43):
1. KİME (otomatik): carinin gecikmiş borcu > 0 (vade < bugün, yerel gün; vadesiz kalemin vadesi belge günü → ertesi gün — S1, M1f) ve kalemin kaynağı ayırt edilmez (fatura, taksit, Borç Yaz, açılış, karşılıksız, kapatılmış kartın borçta kalanı — 22.11 06:32, B1, S220). Girdi: senaryodaki açık kalemler (B-1); kâhin kalem kaynağını yalnız {{3}} için okur. [S-C5C-1'e bağlı: B seçilirse "vadesi yazılmamış kalem hatırlatmaya girmez".]
2. KİMDEN ÖNCE ELENİR (yeni nedenler): Tedarikçi (S93; S-C5C-2'ye göre Diğer de), Ödeme Sözü Var (S52, S72 söz günü dahil, S73 bütün borç, K9-1 ertesi takvim günü serbest). Yeni girdi: carinin türü; Ödeme Sözü (kalem başına söz günü; carinin sözü = bugün ya da sonraki en geç söz günü — S72 / S73).
3. ELEME SIRASI ve ADLAR (öneri uygulanır; ileti iki okumada da gitmez): Silinmiş → İstemiyor → Pasif → numara → Tedarikçi → Şüpheli Alacağı Var → Ödeme Sözü Var → Gecikmiş Borç Yok → Zaten Kuyrukta → Sonucu Belirsiz → Daha Önce Gönderildi. Net borç ≤ 0 adı "Gecikmiş Borç Yok" (secenek yaprağı kalkar — Y13-7).
4. ELLE SEÇİM (S-C5C-7'ye göre): A ise elle işareti şüpheli VE söz etiketli kişiye uygulanır (kâhinin `supheli_elle` girdisi genelleşir: etiketli kişi listesi); tedarikçiye uygulanmaz (S-C5C-3 = A ise). Elle işaretli işte söz / şüpheli gönderim anında elemez; tutar şüphesiz gecikmiş (S17).
5. GÖNDERİM ANI (S-C5C-5, S-C5C-6'ya göre): söz ve tür gönderim anında da denetlenir (S7-b düzeni); Devam Et, Sınır, Meta Bekletti 2. denemesi, Başarısızları Yeniden Dene aynı denetim.
6. YİNE DE GÖNDER İÇERİĞİ (S-C5C-8'e göre): A ise hatırlatmada içerik gönderim anında yeniden hazırlanır ({{3}}/{{4}}/{{5}} gönderim anındaki); Ekstre'de donmuş içerik aynen.
7. {{3}}: gecikmiş açık kalemlerin (şüpheli payı düşülmüş kalanı > 0) en eski vadesi; {{4}}: onların toplamı (net borçla sınırlı); {{5}}: gönderim anındaki bakiye (elle seçilmiş şüpheli caride kâhin bugün `plan_susuyor` — S-C5C-10'un yanıtıyla kesinleşir).
8. DÖNEM: değişmez (gün; Zaten Kuyrukta günsüz). Sürüm geçişi senaryosu: aynı gün eski kuralla gitmiş hatırlatma → yeni kuralla aynı gün R3 (İLKEYLE 3).
9. DEVİR (S-C5C-9'a göre; D6 bakımı ile aynı bakımda değil — D4b'den sonra ayrı): devir anında süren toplu iş; devir sonrası kimlik / kalem vadeleri aynı.
10. Mutantlar (her yeni kural ≥ 1): söz günü hariç sayılırsa; tür okunmazsa; Diğer elenirse/elenmezse; şüpheli kaydı yerine kuyruk payı; elle işareti tedarikçiyi geçirirse; gönderim anında söz denetlenmezse; Yine de Gönder donmuş tutar.

## 8. DOĞRULANMADI / DENENMEYEN

- Büyük veride şüpheli kaydı açık, Ödeme Sözü süren, tedarikçi / Diğer'de gecikmişi olan cari YOK → bu sınıflar yalnız 14 carilik küçük senaryoda görüldü (her biri tek cari).
- Önizlemenin kendisi (HTTP + sahte Meta) koşulmadı; "bugün" sütunu `overdueOf` + `eligibility`'nin aynı alanlarla yeniden okunmasıdır (kod değiştirilmedi, betikte birebir). Kod turu sınıf testini
  gerçek önizlemeyle koşmalı.
- Hız sayıları yük 6–7 altında (GEÇERSİZ); yalnız büyüklük fikri verir.
- İkinci şirket (002) büyük veride okunmadı (yalnız 001).
- Muhasebe (cari) kâhininin "hatirlatma" modelinin söz / tür / Diğer'i nasıl ele aldığı OKUNMADI (kâhin kodu ve README'si bu görevin okuma listesinde değil) — kâhin bakımında teyit.
- Devir anında WhatsApp işçisinin bakım kipinde durup durmadığı (D3-D4 G7 "arka plan yazıcıları kapalı") doğrulanmadı → S-C5C-9 ve D4b'ye.
- Arşiv görünümünde WhatsApp düğmelerinin kapalı olduğu (taslak 8.4) koddan doğrulanmadı (D5 henüz yok).
- Yaygın muhasebe programlarının (Mikro, Netsis, Logo, AKINSOFT) hatırlatma davranışı: belgeleri / ekranları okunmadı — dayanak yazılmadı.
DENENMEYEN: e2e / ekran (plan ajanı); tam `npm test` (görev gereği YOK); Windows.

## 9. SONRAKİ SÜRÜME (2.5.1'in içinde kovalanmaz — 20.11 kuralı)

- `totals.overdue` alanının adı / anlamı (B-4: anlam değişmez; yeniden adlandırma ayrı iş).
- Rapor Merkezi "Geciken taksiti olan" süzgecinin ADI (sayı zaten doğru) → müşteri isteğinin Rapor Merkezi turuna (2.5.1 içinde; Ç5-C değil).
- Önizlemenin bugünkü hızı bütçeyi aşıyorsa (6d) ve Ç5-C kötüleştirmiyorsa → hız işi kullanıcı kararına; Ç5-C'yi bekletmez.

## 10. COMMIT LİSTESİ VE DAL UCU
- be1730cb adım 1 (bugünkü durum) · 8d3ad542 adım 2–3 (fark tablosu + kanıt dosyaları + ilke taslağı) · 0939003c adım 4 (paketleme, sonuç) · bu satırı ekleyen commit (dal ucu; `git log -1`).
- Dal: `worktree-agent-a66f8ceb164363d04`, taban `t251-taban` (64396478). PUSH YOK. Yazılan yollar yalnız `docs/devir/C5C-ILKE-TASLAK.md` ve `docs/devir/2.5.1-DEVAM/pc5c-*`.
- Not defteri: veri kopyası `scratchpad/pc5c-is/veri` iş bitince tam yoluyla silindi; betikler `scratchpad/pc5c-is/betik/` (kopyaları depoda `pc5c-*-betik.mjs`, `pc5c-siniflar.py`).
