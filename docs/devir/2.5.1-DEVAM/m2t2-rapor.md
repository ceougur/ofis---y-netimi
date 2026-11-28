# M2 TUR 2 — Değersiz Alacak sınırı: hız + S-DKM2-2 = A + S-DKM2-3 iletisi (2.5.1; rapor taslağı)

Taban: `t251-m2t2-taban` (08f1a2d7). Görev metni: `docs/devir/2.5.1-DEVAM/m2t2-istem.txt`.

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

