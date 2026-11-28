# M2 TUR 2 — Değersiz Alacak sınırı: hız + S-DKM2-2 = A + S-DKM2-3 iletisi (2.5.1; RAPOR)

Taban: `t251-m2t2-taban` (08f1a2d7). Dal: `worktree-agent-a2da3cc091eb2c5df`. Görev metni: `docs/devir/2.5.1-DEVAM/m2t2-istem.txt`.
Ortam (son okuma): yük 10,7 / 4 çekirdek (başka ajanların koşuları), bellek kullanılabilir 9 GB, disk boş 8,0 GB.

## DEĞİŞEN GÖZLENEBİLİR DAVRANIŞ (önce → sonra)
1. Cari kartı → Şüpheli Alacak listesi ve Değersiz Alacak Yaz formunun ucu bağlı tahsilat GÜNÜ sayısıyla artık büyümüyor. p6 verisi, aynı kopya (yük altında GÖSTERGE — ana oturum flock -x ile ölçer):
   250 gün / 3 kayıt: liste medyan tur 1 132.828 ms → 23 ms (tur 1 öncesi 15 ms); form ucu 46.083 ms → 18 ms. Sınır / öneri / gün / düğme tur 1 ile BİREBİR (eşdeğerlik testi).
2. Fatura → İptal Et (ve Sil, e-Belge iptali, Banka'dan Ters Kaydet): Değersiz Alacak yazılmış caride iptal cariyi Değersiz yüzünden eksiye düşürecekse — önce 409 "İşlem geri alındı: kayıt
   defterler arasında sapma oluşturacaktı … yöneticinize bildirin" (yanlış neden); sonra 409 doubtful-writeoff-balance "Fatura iptal edilemez: bu caride 17.09.2026 tarihli 3.000,00 TL Değersiz
   Alacak satırı var; iptalden sonra cari 2.476,45 TL alacaklı (eksi bakiye) olurdu. Değersiz Alacak yazımı cariyi alacaklıya düşüremez — bu fatura olmasaydı o kayda en çok 123,55 TL Değersiz
   Alacak yazılabilirdi. Ne yapmalı: önce Değersiz Alacak satırını silin (cari kartı → Şüpheli Alacak → kaydın Değersiz satırındaki × düğmesi), sonra faturayı iptal edin; gerekirse Değersiz
   Alacak'ı yeniden yazın (form yazılabilecek tutarı gösterir). Hiçbir şey kaydedilmedi." Pencere açık; fatura ve bakiye 423,55 değişmez (ekran: m2t2-ekran/ekran-iptal-*/m2t2-1-iptal-reddi.png).
3. Satıştan İade (yeni ve Düzenle'si) aynı durumda: önce KABUL (bakiye −2.476,45); sonra 409 "İade faturası kaydedilemez: … en çok 100,00 TL …". Eksiye düşürmeyen iade kabul (değişmedi).
4. Değersiz'den sonra eksiye düşürmeyen iptal (ör. ek borç var): önce 409 ledger-integrity (değişmez (i)'nin yanlış kırmızısı); sonra KABUL, Mutabakat tamam.
5. v2.5.0'ın ürettiği veri (Değersiz → iptal, bakiye −2.476,45): önce Mutabakat Testi KIRMIZI ("yazıldığı andaki sınırı (123,55 TL) aşıyor"); sonra TAMAM.
6. Öbür şüpheli kaydın silinmesi reddi (S-DKM2-3 = C) KALDI; ileti "yazıldığı andaki sınırı aşardı" yerine "bu kayıt silinirse carinin bağsız tahsilatı Değersiz Alacak yazılan kayda düşer ve o kaydın
   20.09.2026 tarihli 3.000,00 TL Değersiz Alacak satırı, kayda düşen tahsilat çıkınca kalanı aşar … Ne yapmalı … (cari kartı → Şüpheli Alacak → kaydın Değersiz satırındaki × düğmesi)" (§3; ekran
   m2t2-2-silme-reddi.png).
7. Kapı reddi YALNIZ Değersiz sınırı (S270: writeoff-limit / writeoff-balance) nedeniyse genel "yöneticinize bildirin" yerine dört parçalı Türkçe cümle (S155 deseni); karışık nedende genel ileti AYNEN.

## DEĞİŞEN DOSYALAR
- server/lib/bank/doubtful.mjs — hız (writeOffDays → saf pickWriteOffQuotes / chooseWriteOffQuote; writeOffLimitOf kısaltmaları; writeOffOpenUpper; F belleği; withExtra'da önceki gün kesiti ve işlem
  dışı paylaşılan türetilmiş kurulum; WRITE_OFF_TEST { exact, count } yalnız test), writeOffBalanceGuard + writeOffRoomAfter (S-DKM2-2), değişmez (i)'de bağı iptalle kopan tahsilat, writeoff-*
  sorunlarına `figure`, silme çakışması iletisi (S-DKM2-3).
- server/lib/integrity.mjs — doubtful:records'a `writeOffs` rakamları (yalnız bütün sorunlar S270 ise), writeOffText.
- server/routes/invoices.mjs — YALNIZ denetimin çağrısı: cancel (iptal / silme / e-Belge / Ters Kaydet; önizlemede de), writeIssued (yeni satıştan iade), editInvoice (iadenin Düzenle'si).
- Yeni testler: test/supheli-degersiz-hiz-m2t2-251.test.mjs, test/supheli-degersiz-iptal-iade-m2t2-251.test.mjs, test/e2e/senaryo-degersiz-iptal-m2t2-251.mjs, test/fixtures/m2t2-v250-iptal/ (v2.5.0
  üretimi veri, gzip 34 KB + üretici notu). Kanıt docs/kanit/2026-11-28/m2t2-*.
- Dokunulmadı: tek borç sırası ve girdisi, defter rotası, şüpheli defter türetmesi (doubtful-gl), göçler, client, package.json, tools, .github, kılavuz.

## 0. NASIL BOZULUR (koddan ÖNCE yazıldı)

Hız düzeltmesi (YÜKSEK-1) — eşdeğerlik bu eksenlerde bozulabilir:
1. Bağlı tahsilat günü sayısı 0 / 1 / 60 / 250: aday gün kümesi boş, tek gün, çok gün; sınırın değiştiği gün ilk gün, bugün ya da ARADA.
2. Kayıt sayısı 1 / 3: öbür kaydın Değersiz satırı yeni Değersiz'den SONRA sıralanıyorsa ("later" — taşma) sınır gün ilerledikçe ARTABİLİR (F azalır, taşma kısıtı gevşer) → yalnız "ilk gün + bugün" en çok yazdıran günü kaçırabilir (önermenin karşı örneği adayı).
3. Bağsız tahsilat (her tarihte sınırı küçültür), Şüpheliden Çıkar (öbür kaydın kalanı sıfırlanır), S155 bakiye sınırı (öneri < sınır), carinin borç bakiyesi (sınır < kalan), kilitli dönem (ilk gün kilidin ertesi), ileri tarih.
4. Aynı gün sırası: Değersiz o günün bağlı payından önce (S264); geri yüklemede satır kendi yazım anıyla sıralanır (aynı günün öbür Değersiz satırlarının ARASINA girebilir).
5. Eşitlikler: birden çok günde aynı öneri / sınır → en erken gün seçilir; öneri eşit, sınır büyük olan seçilir.
6. İşlem içi (Değersiz Yaz, geri yükleme — bellek kapalı) ve işlem dışı (liste, form ucu — bellek açık) iki yol.
7. İki saat dilimi (UTC, Europe/Istanbul) — "bugün" ve gün sınırı.

S-DKM2-2 = A (iptal / iade reddi) — bozulma yolları:
8. Değersiz'den sonra fatura iptali; aynı faturanın tam iadesi; kısmi iade; iadenin düzenlenmesi (miktar artışı); faturanın silinmesi (iptali çağırır); e-Belge iptali (iptali çağırır).
9. Cari zaten eksideyken (Değersiz'den bağımsız avans) iptal / iade: "Değersiz yüzünden" iki okuma (Değersiz olmasaydı da eksi kalır mı?).
10. Fatura TUTARININ düzenlemeyle düşürülmesi; bağlı evrakın karşılıksız çıkması / iadesi (aynı kök neden mi — ÖLÇ).
11. v2.5.0 GERÇEK kodunun ürettiği veri: Değersiz → iptal o sürümde kabul edilmiş; yeni kod Mutabakat'ta YANLIŞ kırmızı vermemeli (değişmez (i): bağı iptalle kopan tahsilat).
12. Değişmez (i)'nin gevşemesi yalnız iptalden SONRA yazılmamış Değersiz satırlarını etkilemeli; gevşeme yeni yanlış kırmızı üretmez (yalnız satır çıkarır → sınır büyür).

S-DKM2-3 = C (öbür kaydın silinmesi reddi kalır, ileti düzelir):
13. Kayıt silme, kayıt geri yükleme, Değersiz satırı silme — üç yol aynı çakışma iletisini kullanır; ileti yola göre doğru anlatmalı.
14. Kapı reddinde writeoff-limit / writeoff-balance nedeni (S155 deseniyle anlaşılır ileti); başka nedenle birlikte gelirse genel ileti kalır.

## 1. HIZ (YÜKSEK-1) — tasarım ve kanıtı

Önerme (dar kontrol): F(S, D) — D gününe ve sonrasına ait faturaya bağlı satırlar yokken kaydın sondaki kalanı — gün ilerledikçe ARTMAZ.
KANIT (çözümleme; kod: lib/bank/doubtful.mjs writeOffDays notu): D₂ > D₁ için D₂ dünyası D₁ dünyasına yalnız [D₁, D₂) günlerinin bağlı satırlarını EKLER. D₁'den önce iki dünya aynıdır (aynı alacaklar,
aynı kesitler — kesitin `kept` kümesi yalnız kesit gününe kadar olan satırları alır; aynı günün `include`'u yalnız o günün satırlarına bakar). Eklenen satırlar ayırıcıda (lib/doubtful-gl.mjs allocateDoubtful)
kalanı yalnız KÜÇÜLTÜR (collect: min(kalan, pay)). Ortak olayların her biri tekdüzedir — küçük kalan küçük kalır: bağsız alacak en eski açık kayıttan sırayla (açık kalan_i = max(0, r_i − (c − Σ önceki
r_j))'nin r'de tekdüzeliği; kart satırının openedOn uygunluğu iki dünyada aynı), Değersiz satırı max(0, r − m), Şüpheliden Çıkar kalanı sıfırlar (iki dünyada aynı gün), karşılık kalana dokunmaz; ortak
bağlı satırlar yalnız D₁'den öncedir (D₁ ve sonrası bağlı satırlar D₁ dünyasında yok) → payları iki dünyada aynı. Tümevarımla her an kalan_D₂ ≤ kalan_D₁ → F(S, D₂) ≤ F(S, D₁). Kilit yalnız ilk günü
ileri alır (aday günler kilidin ertesinden); bakiye sınırı (cap = min(F, bakiye)) günden bağımsız sabittir. Dallar: bağsız tahsilat ✓, Şüpheliden Çıkar ✓, S155 (öneri ≤ sınır ≤ cap) ✓, kilit ✓.
DENEYLE: eşdeğerlik testinde her adımda her açık kaydın 13.09–15.10 arası BÜTÜN günlerinde F ölçüldü, hiçbir yerde artmadı (sayılar §4).

Önermenin SONUCU ("listede yalnız ilk gün ve bugün yeter") KANITLANAMADI: sınır = min(F, deneme kısıtı); deneme kısıtı ("later" — yeni satır SONRAKİ bir Değersiz satırını taşırır; kuyruğun bağlı payı
değişir) gün ilerledikçe GEVŞEYEBİLİR, en çok yazdıran gün aradaki bir gün olabilir. Bu yüzden öneri olduğu gibi UYGULANMADI; BAŞKA YOL (sonuç tur 1 ile BİREBİR):
1. writeOffDays — aday günler (tur 1'in aynı kümesi) sırayla; gün d yalnız sonucu DEĞİŞTİREBİLİRSE hesaplanır: cap(d) < en iyinin önerisi, ya da cap(d) = en iyinin önerisi ve (en iyinin sınırı > cap(d)
   ya da en iyi d'den önceki gün) ise d seçimi (öneri → sınır → en erken gün) ve anyMinor'u değiştiremez; F artmadığı için koşul bir günde sağlanınca sonraki her günde sağlanır → tarama durur.
   Tipik veride (bağlı tahsilatlar kaydı küçültmüyor) 2 sınır hesabı: ilk gün + bugün.
2. writeOffLimitOf — (a) yeni satırdan SONRA sıralanan Değersiz satırı yoksa deneme gereksiz: üst uç ≤ F(S, D) ≤ kaydın D anındaki kalanı (D'den önceki olaylar aynı; sonrakiler küçültür) → yeni satır
   tam düşer, taşabilecek başka Değersiz satırı yok ("grows" yalnız sonra gelen hedefli satırda). (b) S155: önce D ve sonrası bağlı satırlar çıkarılmış dünyada açık şüpheli (üst sınır; aynı tümevarımla
   gerçek ≤ üst sınır); sağlanıyorsa gerçek de sağlar, D'den sonra bağlı satır yoksa üst sınır gerçeğin kendisidir; yoksa tam deneme.
3. linkedShares.withExtra — varsayımsal satırın gününden ÖNCEKİ günlerin kesiti varsayımsız kesitin aynısı (kesit sonraki günü almaz) → bellekten; türetilmiş kurulum işlem dışında aynı veri durumunda
   çağrılar arasında paylaşılır (cari kartı listesi + hemen ardından açılan form ucu).
4. F(S, D) gün başına bir kez (bağlamın `rooms` belleği).
HAKEM: WRITE_OFF_TEST.exact = true dördünü kapatır (tur 1'in tam hesabı). İş sayısı sayacı WRITE_OFF_TEST.count (yalnız test).

## 2. S-DKM2-2 = A (iptal / iade reddi) — uygulama
- Kural (lib/bank/doubtful.mjs writeOffBalanceGuard): işlemin başında bakiye, sonunda yeniden; işlem bakiyeyi DÜŞÜRDÜ, sonuç EKSİ ve carinin Değersiz Alacak satırları olmasaydı eksi olmazdı
  (bakiye + Σ Değersiz ≥ 0) → 409 doubtful-writeoff-balance. Değersiz satırı olmayan caride hiçbir şey okunmaz.
- Çağıran yollar (routes/invoices.mjs — yalnız bu denetimin çağrısı): fatura iptali (silme, e-Belge iptali ve Banka'dan Ters Kaydet iptali çağırır; önizleme dryRun'da da — e-Arşiv iptali
  entegratöre gitmeden önce), yeni satıştan iade (taslaktan kesim dahil), satıştan iadenin Düzenle'si (öncesi Düzenle'den önceki bakiye).
- İleti (dört parça): ne oldu ("bu caride 17.09.2026 tarihli 3.000,00 TL Değersiz Alacak satırı var; iptalden sonra cari 2.476,45 TL alacaklı (eksi bakiye) olurdu"), neden ("Değersiz Alacak
  yazımı cariyi alacaklıya düşüremez — bu fatura olmasaydı o kayda en çok 123,55 TL Değersiz Alacak yazılabilirdi"), ne yapmalı ("önce Değersiz Alacak satırını silin … sonra faturayı iptal
  edin; gerekirse Değersiz Alacak'ı yeniden yazın (form yazılabilecek tutarı gösterir)"), nereye ("cari kartı → Şüpheli Alacak → kaydın Değersiz satırındaki × düğmesi" — ekran görüntüsüne
  bakılarak yazıldı: kartta 'Değersiz Alacaklar' başlığı YOK, satır kaydın satırında, silme ×).
- "En çok N": aynı sınır işlevi (writeOffLimitOf) işlemden SONRAKİ hâlde, kaydın Değersiz satırları yokken, satırın gününde; formun önereceği tutar. KARAR METNİNDEKİ ÖRNEK "523,55" BAKİYEDİR;
  sınır S270 gereği kaydın kalanıdır: iptalle bağı kopan 2.876,45 tahsilat bağsız olur, aynı gün Şüpheliye Al'dan SONRA sayılır (sınıf sırası) → 3.000 − 2.876,45 = 123,55. Tam iadede iade
  alacağı sonradan gelen bağsız alacak (S270) → 3.000 − 2.900 = 100,00. (Karar A'nın kendisi — ret — değişmedi; yalnız iletideki sayı programın sınırından.)
- Değişmez (i): bağlı olduğu fatura W'den SONRA iptal edilen / silinen tahsilat 'sonradan değişmiş'. İptal bağı satırda iz bırakmadan siler → carinin satış faturasının son iptal / silinme anından
  ÖNCE yazılmış, bugün bağsız her tahsilat o anda değişmiş sayılır (BİLİNEN SINIR: o faturayla ilgisiz eski bağsız tahsilat da W'nin dünyasından çıkar — denetim yalnız GEVŞER, yanlış kırmızı
  üretmez). Fatura Düzenle'si bağı koparmaz: bağlı tahsilat zaten W'nin dünyasında değil (W günü ve sonrası) ya da her durumda içinde (önceki gün) — ek koşul gerekmedi.
- Kapı reddi (lib/integrity.mjs doubtfulText): ret YALNIZ writeoff-limit / writeoff-balance nedeniyse dört parçalı cümle; başka nedenle birlikteyse genel ileti AYNEN (kural ve kod aynı).

## 3. S-DKM2-3 = C — ileti
Ret AYNEN (BİLİNEN SINIR). Önce: "Şüpheli alacak kaydı silinemez: carinin öbür şüpheli kayıtları bozulurdu (20.09.2026 tarihli 3.000,00 TL Değersiz Alacak satırı yazıldığı andaki sınırı aşardı).
Önce Değersiz Alacak satırını silin, sonra yeniden deneyin." Sonra: "Şüpheli alacak kaydı silinemez: bu kayıt silinirse carinin bağsız tahsilatı Değersiz Alacak yazılan kayda düşer ve o kaydın
20.09.2026 tarihli 3.000,00 TL Değersiz Alacak satırı, kayda düşen tahsilat çıkınca kalanı aşar (Değersiz Alacak bu kalanı aşamaz). Ne yapmalı: önce o Değersiz Alacak satırını silin (cari kartı →
Şüpheli Alacak → kaydın Değersiz satırındaki × düğmesi), sonra bu işlemi yeniden deneyin; gerekirse Değersiz Alacak'ı yeniden yazın (form yazılabilecek tutarı gösterir). Hiçbir şey kaydedilmedi."
Geri yükleme yolunda "geri yüklenirse". Öbür çakışma nedenleri (Şüpheliden Çıkar tutarı, karşılık) eski iletisiyle.

## 4. KARARIN SÖYLEMEDİĞİ YOLLAR (ÖLÇÜLDÜ — not defteri m2t2/betik/p9-kararsiz-yollar.mjs; yeni kod = eski kod sayıları aşağıda)
- P9a fatura TUTARININ Düzenle ile düşürülmesi (2.900 → 100) Değersiz'den sonra: yeni ve eski kod KABUL, bakiye −2.376,45, değişmez temiz. Aynı kök (bakiye Değersiz yüzünden eksi) — iki okuma →
  KODLANMADI, KULLANICIYA SORULMALI S-M2T2-2.
- P9b bağlı ÇEKİN karşılıksız çıkması: bakiye YÜKSELİR (423,55 → 3.300), eksiye düşme yok — aynı kök DEĞİL; değişmez temiz.
- P9c Değersiz olmadan da eksi kalacak iptal (avans 3.000): yeni kod KABUL (−5.476,45; Değersiz olmasaydı −2.476,45); eski kod (tur 1) 409 ledger-integrity (YANLIŞ neden — değişmez (i)'nin yanlış
  kırmızısı). İki okuma → KODLANMADI (kabul), KULLANICIYA SORULMALI S-M2T2-1; sınırı belgeleyen test var (yanıt A gelirse değişir).
- P9d aynı cariye alış faturası: ölçülemedi (alış formu tedarikçi fatura numarası istiyor — betik eksik); karar dışı, DENENMEYEN.

## 5. KULLANICIYA SORULMALI (para / kapama — ders 43; ikisi de UÇ DURUM)
S-M2T2-1 — Değersiz Alacak yazılmış caride fatura iptali / iadesi, cari Değersiz OLMADAN da eksi (alacaklı) kalacaksa? Örnek: taban T + Değersiz 3.000 @17.09 (bakiye 423,55) + 05.10 avans 3.000
(bakiye −2.576,45) → fatura 2.900 iptali.
  A (ÖNERİ): reddedilsin — Değersiz satırı varken iptal / iade bakiyeyi eksiye götürüyorsa her durumda ret (ileti aynı). İptal 409, bakiye −2.576,45 kalır; kullanıcı Değersiz'i silip iptal eder,
     sonra kalan alacak varsa yeniden yazar. Gerekçe: fatura iptal edilince yazılan 3.000'in karşılığı olan alacak artık yok; defterde kalırsa 659 / 129 fazla gösterilir.
  B: bugünkü gibi kabul — yalnız "Değersiz yüzünden" eksiye düşen (Değersiz olmasaydı ≥ 0) iptal / iade reddedilir. İptal kabul, bakiye −5.476,45 (Değersiz 3.000 defterde kalır).
  C: Uç durum böyle kalsın (BİLİNEN SINIR olarak yazılır) — B ile aynı sayılar.
  Yaygın programlar: belgesi okunmadı (dayanak yazılmadı).
S-M2T2-2 — Değersiz Alacak'tan sonra faturanın TUTARI Düzenle ile düşürülürse? Örnek: taban T + Değersiz 3.000 → fatura 2.900 → 100.
  A (ÖNERİ): iade gibi reddedilsin (S241 = A "Düzenle azalışları faturaya gelen iade gibi" ile tutarlı; ileti iadeninkiyle aynı). 409, bakiye 423,55.
  B: bugünkü gibi kabul (Düzenle kayıt hatası düzeltmesidir). Kabul, bakiye −2.376,45.
  C: Uç durum böyle kalsın (BİLİNEN SINIR) — B ile aynı sayılar.
  Yaygın programlar: belgesi okunmadı.
Not (bilgi, soru değil): karar metnindeki örnek "en çok 523,55" bakiyedir; programın sınır işlevi S270 gereği 123,55 verir (§2) — ret kararı aynı.

## 6. BAŞ MİMAR KARARI GEREKİYOR
- Sonra gelen Değersiz satırı olan caride liste / form ucunun SOĞUK (ilk) çağrısı bağlı tahsilat günü sayısıyla hâlâ büyür: kayıttan SONRAKİ her bağlı satır için denemenin kuyruk kesiti
  (doubtfulBefore — kuyruğu baştan koşar) bir kez kurulur. 250 gün / 3 kayıt / bugün tarihli 100 TL Değersiz: soğuk liste ~0,6–1,0 sn (tur 1'de bu veride dakikalar), aynı veri durumunda
  sonraki çağrılar ~20–40 ms (bellek). Kökten çözüm kuyruğun kesitini artımlı kurmak (lib/obligation-queue.mjs doubtfulBefore — TEK BORÇ SIRASI ZİNCİRİ dosyası, bu turda YAZILAMAZ). Öneri: BİLİNEN
  SINIR (gerçekçi veride kayıttan sonra yüzlerce bağlı tahsilat günü + sonra gelen Değersiz satırı seyrek) ya da zincire (D4a tur 2'den sonra) küçük bir hız işi.

## 7. SONRAKİ SÜRÜME (20.11 kuralı)
- Liste satırının 'why' metni ilk günde "o günün faturaya bağlı tahsilatı Değersiz'den sonra sayılır" diyor; bağlı tahsilat SONRAKİ bir günde olsa da (görünüm ayrıntısı; sayılar doğru).
- Yaşayan mutant M8 (önceki gün kesiti aynı günü de alır): davranışa yansıyan fark üretilemedi — eşdeğer mutant olabilir (DOĞRULANMADI).
- P9d (alış faturası) betiği tamamlanmadı.



## 8. TESTLER — taban kırmızısı NEDENİYLE / yeni yeşili (UTC ve Europe/Istanbul)
| Test | Taban (kırmızı nedeni) | Yeni |
|---|---|---|
| hız: S155 dalı + ara bağlı gün (elle: 17.09 sınır 3.000 / öneri 2.923,55; bugün 123,55) | 'WRITE_OFF_TEST yok' — hakem bayrağı yok (yapısal) | yeşil |
| hız: budama kuralı, 20.000 rastgele tablo (saf işlev) | 'pickWriteOffQuotes yok' (yapısal) | yeşil |
| hız dişi: iş sayısı (30 bağlı gün → liste 2 sınır hesabı / 0 deneme) | bayrak yok (yapısal); GERÇEK diş: mutant M1 + p6 ölçümü (tur 1 132 sn) | yeşil |
| eşdeğerlik 4 tohum × 8 cari × 16 adım + kilit (liste + form ucu + işlem içi = tam hesap; F artmaz) | bayrak yok (yapısal) | yeşil (tohum başına 136 anlık görüntü, ~1.600 uç teklifi, ~3.700 F denetimi; ara gün en iyi 0) |
| iptal → 409 dört parçalı (123,55) | 409 ledger-integrity (yanlış neden) | yeşil |
| silme (iptali çağırır) | 409 ledger-integrity | yeşil |
| tam iade → 409 (100,00) | 200 (kabul, −2.476,45) | yeşil |
| iade Düzenle büyütünce 409 | 200 | yeşil |
| eksiye düşürmeyen iptal kabul + Mutabakat | 409 ledger-integrity | yeşil |
| avanslı iptal (soru açık; bugünkü gibi kabul) | 409 ledger-integrity | yeşil |
| v2.5.0 verisi Mutabakat | false (writeoff-limit 123,55) | yeşil |
| S-DKM2-3 iletisi | eski anlatım | yeşil |
| kapı iletisi (S270 nedenleri; karışık → genel) | genel ileti | yeşil |
| e2e senaryo-degersiz-iptal-m2t2-251 | 7 / 14 (iletiler eski) | 14 / 14 |
Sayılar: yeni 16/16 UTC + 16/16 İstanbul (m2t2-son-yeni-testler-*); taban 0/16 iki TZ (m2t2-eski-yeni-testler-*); e2e yeni 14/14 iki TZ, taban 7/14 iki TZ.

## 9. KABUL
A ✓ (§8; nedenler günlükte okundu). B ✓ eşdeğerlik iki TZ birebir. C (gösterge, §10): 250 günde liste 23 ms (tur 1 öncesi 15), form ucu 18 ms; sonra Değersiz satırlı caride liste medyan 53 ms (önce 27),
soğuk ilk çağrı 813 ms (önce 511) — §6. D mutantlar 11 / 12 (M8 yaşadı). E komşular 944 / 944 UTC + 944 / 944 İstanbul (80 dosya), senaryo-degersiz-siniri-m2-251 24 / 24 iki TZ. F v2.5.0 verisinde
Mutabakat tamam. Kâhin: test:kahin-cari 25.957 / 25.957 (0 fark), test:kahin-defter 187 / 187.

## 10. HIZ TABLOSU (aynı kopyalar; ms medyan / en çok; olay döngüsü en çok ≈ en çok; YÜK 5–10 / 4 çekirdek → ders 52: GEÇERSİZ, GÖSTERGE — ana oturum flock -x ile ölçer)
| Veri | Yol | Yeni | Tur 1 (taban) | Tur 1 öncesi |
|---|---|---|---|---|
| 60 gün / 1 kayıt | liste | 24 / 78 | 1.399 / 2.817 | 5 / 44 |
| 60 gün / 1 kayıt | form ucu | 12 / 13 | 1.059 / 1.454 | — |
| 60 gün + sonra Değersiz | liste | 25 / 215 | 1.364 / 1.469 | 25 / 114 |
| 60 gün + sonra Değersiz | form ucu | 17 / 53 | 1.112 / 1.227 | — |
| 250 gün / 3 kayıt | liste | 23 / 569 | 132.828 (1 kez) | 15 / 318 |
| 250 gün / 3 kayıt | form ucu | 18 / 26 | 46.083 (1 kez) | — |
| 250 gün + sonra Değersiz | liste | 53 / 813 | 120.322 (1 kez) | 27 / 511 |
| 250 gün + sonra Değersiz | form ucu | 19 / 188 | 50.124 (1 kez) | — |
"En çok" = soğuk ilk çağrı (her sürümde). Ham çıktılar docs/kanit/2026-11-28/m2t2-olcum/.

## 11. MUTANTLAR (son kod; m2t2-mutant/ozet-son.txt)
M1 aday günler geri → YAKALANDI · M2 iade denetimi yok → YAKALANDI · M2b iade Düzenle denetimi yok → YAKALANDI · M2c iptal denetimi yok → YAKALANDI · M3 değişmez (i) fatura iptali koşulu yok →
YAKALANDI · M4 silme iletisi eski → YAKALANDI · M4b kapı iletisi genel → YAKALANDI · M5 sonra gelen Değersiz denemesi yok → YAKALANDI · M6 S155 üst sınırı kesin sayılır → YAKALANDI · M7 budama eşitlik
koşulu yok → YAKALANDI · M8 önceki gün kesiti aynı günü de alır → YAŞADI · M9 denetim Değersiz olmadan da eksiyi reddeder → YAKALANDI.

## 12. CI LİSTESİNE EKLENECEK
test/e2e/senaryo-degersiz-iptal-m2t2-251.mjs (CI e2e + yayın listesi). Node testleri test/*.test.mjs deseniyle zaten koşar.

## 13. KILAVUZ ÖNERİSİ
"Değersiz Alacak yazılmış bir carinin faturasını iptal etmek ya da iadesini almak cariyi alacaklıya düşürecekse program izin vermez. Önce cari kartında Şüpheli Alacak bölümünde kaydın Değersiz
satırındaki × ile Değersiz Alacak satırını silin, sonra iptali ya da iadeyi yapın; alacak hâlâ tahsil edilemiyorsa Değersiz Alacak'ı yeniden yazın — form yazılabilecek en çok tutarı gösterir."

## 14. DENENEN / DENENMEYEN / BİLİNEN SINIRLAR
DENENEN (ders): 7, 10 (80 komşu dosya iki TZ; şema kapısı + geri yükleme dahil), 12, 13, 17 (v2.5.0 gerçek verisi), 23 / 25, 38, 47, 53 (a).
DENENMEYEN: iki şirket (bellek store'a bağlı WeakMap; ayrı denenmedi); Windows (CI'de); alış faturası (P9d); yüksüz hız ölçümü; toplu "Seçilenleri İptal Et" ekrandan (aynı cancel çağrısı);
Silinenler'den fatura geri yükleme (iptal edilmiş döner).
BİLİNEN SINIRLAR: değişmez (i) gevşemesi (§2); sonra gelen Değersiz satırlı caride soğuk ilk çağrı (§6); S-M2T2-1 / -2 yanıtına kadar bugünkü davranış.

## 15. COMMİTLER (t251-m2t2-taban..dal ucu)
130ae811 nasıl bozulur · 849bae14 hız + S-DKM2-2 + S-DKM2-3 + kapı iletisi · f70f663a hız dişi · 088496d7 ekran senaryosu + ileti yolu · 839057bc test sağlamlığı · 285299a6 rapor taslağı ·
72bad85d budama saf işlev + testler · 46fb1bf8 Kanıt · (son) rapor.

## 16. ANA OTURUMUN YENİDEN KOŞACAKLARI
- TZ=UTC ve TZ=Europe/Istanbul: `HUKUK_LICENSE_URL=http://127.0.0.1:9 node tools/kanit.mjs kos m2t2-rk -- node --test test/supheli-degersiz-hiz-m2t2-251.test.mjs test/supheli-degersiz-iptal-iade-m2t2-251.test.mjs`
  (16/16; tabanda — git worktree add --detach <yol> t251-m2t2-taban + yalnız bu iki dosya ve test/fixtures/m2t2-v250-iptal — 0/16).
- `node test/e2e/senaryo-degersiz-iptal-m2t2-251.mjs` (14/14; tabanda 7/14) ve `node test/e2e/senaryo-degersiz-siniri-m2-251.mjs` (24/24), PLAYWRIGHT_BROWSERS_PATH=…/pw-1194.
- Mutasyon `python3 -I docs/kanit/2026-11-28/m2t2-arac/mutant.py` (kopya yolu betikte). Hız (flock -x): m2t2-arac/p6-uret.mjs (taban koduyla, FATURA=250 KAYIT=3 HEDEF=0/1) + p6-olc.mjs.
- `npm run test:kahin-cari`, `npm run test:kahin-defter`; komşular m2t2-arac/komsu.sh (liste komsu-liste.txt).
- Cari kâhini bakımı 33 için beklenen fark: Değersiz'den sonra iptal / tam iade / iade Düzenle büyütmesi / silme, cari Değersiz yüzünden eksiye düşecekse RET (doubtful-writeoff-balance); bugünkü
  kâhin senaryolarında bu sınıf yok (0 fark).
