# P-Ç5C — Ödeme Hatırlatma'nın tek borç sırasına geçişi: plan raporu (2.5.1)

> Plan ajanı; KOD VE TEST YAZILMADI. Taban `t251-taban` (64396478). Kaynaklar: görev metni `docs/devir/2.5.1-DEVAM/pc5c-istem.txt`;
> kararlar `docs/2.5.0-IS-LISTESI.md` (C / D), `docs/GECMIS-KARARLAR.md` (31.10 – 01.11 WhatsApp kararları), `docs/erp/C5-ACILIS-TASARIM.md` §1.4, §2.10, §2.12, §8,
> `docs/erp/C5B-TYK-TASARIM.md` §1, §3, WhatsApp kâhininin `README.md`'si (yalnız belge; model kodu okunmadı), `docs/devir/D3-D4-TASARIM.md` (dal `claude/epic-thompson-w0lc2l`; tabanda yok).
> İlke taslağı (kullanıcı dili): `docs/devir/C5C-ILKE-TASLAK.md`.

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
