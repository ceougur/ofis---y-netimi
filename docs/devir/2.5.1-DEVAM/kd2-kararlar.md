# K-D 2 — Muhasebe kâhini devir bakımı 2: KARAR GİRDİSİ (2.5.1; ana oturum yazdı, 27.11.2026)

Bu dosya kâhin bakımı K-D 2'nin TEK yeni karar kaynağıdır (CLAUDE.md ders 5, 40, 43). Önceki kararlar kâhinin kendi README'sinde, README'nin "Kaynaklar"
bölümünde sayılan belgelerde ve bir önceki bakımın girdisinde (`docs/devir/2.5.1-DEVAM/kd-kararlar.md` — o da izinli) durur. Burada programın kodu, dosya adı,
alan adı YOKTUR; kural dilinde yazılmıştır. Bir kuralın iki okuması çıkarsa KODLAMA — raporda "KULLANICIYA SORULMALI" (TOPLU KÂHİN BAKIMI: bulduğun bütün alt
durumları BİRLİKTE çıkar; ana oturum hepsini tek iletide sorar).

## 1. Yeni KULLANICI KARARLARI (27.11.2026; AYNEN)

Kullanıcı 27.11.2026 11:39 UTC (AYNEN): "devir yapılırken bir sebeple duruyorya, nedenini kullanıcıya açıkça türkçe yazsın program, önerilerine ek olarak bunuda uygula."
Bu iletiyle bir önceki bakımın (K-D) üç sorusu ÖNERİYLE yanıtlandı. Soruların metni AYNEN, seçilen seçenek işaretli:

**S-KD-1 = A.** Soru: S-3 = A "düzeltilmemiş Kural Değişikliği Farkı varken devir durur" kararında, geriye YALNIZ düzeltme fişinin düzeltemediği alt defter farkı kaldıysa
(örnek: aynı caride müşteri hesabı +4.000 / şüpheli hesabı −4.000; toplam 0)?
- **A (SEÇİLEN):** devir yine DURUR; "Kilidi Aç → Yeniden Kilitle" ile fark temizlenince geçer (S-3 = A ile aynı çizgi; çaresi var).
- B: devir geçer, fark arşive "Kesin Değil" notuyla gider. C: uç durum böyle kalsın (BİLİNEN SINIR — kâhin denetlemez, programın davranışı kalır).

**S-KD-2 = A.** Soru: Dönem Kilidi tam kesim gününe (31.12) dayanmışken çıkan kural farkının düzeltme fişi kilit yüzünden 01.01'e düşüyorsa (örnek 3.000 TL)?
- **A (SEÇİLEN):** devir DURUR; kilit geri alınır, fiş eski yılın içinde yazılır, eski yılın kârı 3.000 azalır (fark ait olduğu yılda).
- B: fiş 01.01'e yazılır, devir geçer; fark yeni yılda olağandışı gider olur, eski yıl düzeltilmeden kapanır. C: uç durum böyle kalsın (BİLİNEN SINIR).

**S-KD-3 = B.** Soru: Excel'den yüklenen taksit kartının Kayıt Tarihi kesim gününden ÖNCE, yükleme anı kesim gününden SONRA ise (örnek: Kayıt Tarihi 20.12.2026,
yükleme 03.01.2027, kart 9.000; sonra 31.12.2026 kesimli devir)?
- A: ön denetim devri durdurur.
- **B (SEÇİLEN):** kart ve defter maddesi Kayıt Tarihi'ne göre ESKİ yıla sayılır; yeni yıla devir açılışıyla 9.000 gelir (programdaki öbür kayıtlar gibi tarih esas
  alınır, yükleme anı değil).
- C: uç durum böyle kalsın (BİLİNEN SINIR).

**S-T2-1 = B** (KULLANICI 27.11 14:18 UTC, AYNEN: "önerilerini uygula açık sorulara"). Soru: K'den sonra yapılan "Mahsup Et"in karşı belgesi K'den önceki bir alış faturasıysa? Örnek: Aralık'ta satış 400 ve
alış 150; Ocak'ta yeni satış 300; 17.01'de Ocak satışı Aralık alışıyla 150 mahsup ediliyor. Devirsiz: Aralık satışı 400 açık, Ocak satışı 150 açık (bakiye 550; 01.01–29.01 gecikmiş 400).
- A: böyle kalsın (mahsup yeni yılda etkisiz; Aralık satışı 250 açık, Ocak satışı 300 açık, gecikmiş 250).
- **B (SEÇİLEN):** devir, K sonrası mahsubun K öncesi karşı belgesini o mahsuba ayırır — DEVİRLİ = DEVİRSİZ (örnekte Aralık satışı 400 açık, Ocak satışı 150 açık, gecikmiş 400).
- C: uç durum böyle kalsın (BİLİNEN SINIR).

**DEVİR NEDEN DURDU** — aynı iletinin ikinci kısmı. BAŞ MİMAR OKUMASI (kullanıcıya gösterildi; DEĞERLENDİR): devri durduran HER neden kullanıcıya açık Türkçe cümleyle
yazılır; birden çok neden varsa HEPSİ birlikte listelenir (kullanıcı tek tek düzeltip yeniden denemek zorunda kalmasın); uyarılar (durdurmayan) ayrı başlıkta.
KÂHİNE DÜŞEN KISIM (cümle metni kâhinin işi DEĞİL): bir devir reddinde kâhin, o anda geçerli olan BÜTÜN ret nedenlerini birlikte (küme olarak) verir — ilk nedende
durup öbürlerini gizlemez; durdurmayan durumlar ret kümesine girmez. Ret nedenlerinin kümesi = devir planının kural metinlerinde "devri durdurur" denen
durumların o anda gerçekleşenleri (S-2, S-3, S-KD-1, S-KD-2 ve README'deki öbür durdurma kuralları).

## 2. ÖNCEKİ SÜRÜMÜN KARARI — bir önceki girdide adı geçen ama metni verilmeyen (ANA OTURUMUN GİRDİ EKSİĞİ; AYNEN)

Bir önceki bakımın girdisi §3 madde 2'de "README'deki S179, S184, S215 kararları" dendi; S215'in metni kâhinin izinli kaynaklarında yoktu (kâhin onu kural kaynağı
yapmadı — doğru davranış). Metinler 2.5.0 sürecinden AYNEN (S184 bağlam için yinelenir):

- **S184** (Ç7a tur 2 ajanının sorusu — açılıştan önceki POS tahsilatı; DEFTER KURALI; KULLANICI KURALIYLA ÖNERİ UYGULANDI (14.11 10:17) (kullanıcı 14.11 06:31 AYNEN:
  "bana sorun varsa önerilerini uygula")): açılıştan önceki hesapsız POS tahsilatı yalnız Devir Kapanışı yapılmışsa 519'a geçer, yapılmazsa 108.00'da (Hesabı Atanmamış)
  kalır; kural kitabının K-14 satırı 'Bankaya Geçmiş Say'ı da sayıyor, S179'un metni yalnız havale ve kurumsal kartı söylüyor. A: bugünkü gibi (S179'un metnine uygun).
  B: Bankaya Geçmiş Say da sınır sayılsın. ÖNERİ A = UYGULANDI (kod değişmez).
- **S215** (tek aday dar kontrolünün bilgisi — S184 = A'nın büyüklük etkisi; DEFTER KURALI (önceden karara bağlandı); KULLANICI KURALIYLA ÖNERİ UYGULANDI (20.11 00:06)
  (kullanıcı 14.11 06:31 AYNEN: "bana sorun varsa önerilerini uygula")): temiz 100 bin veride (şirket 001) hesapsız KART çıkışları 519'a geçerken POS girişleri 108.00'da
  kalıyor — 108.00: 6,3 milyon → 55,8 milyon; 102.00: 15,3 milyon → 4,0 milyon; 519: −0,1 milyon → −38,3 milyon; Anlık Durum 'Hesabı Atanmamış' 21,6 milyon → 59,8
  milyon. A: böyle kalsın (S184 = A) + güncelleme notuna 'Hesabı Atanmamış (Kart) bakiyesi artabilir; Devir Kapanışı ile kapanır'. B: S184 = B'ye dön (yeni kod turu).
  ÖNERİ A = UYGULANDI — S184 kararı geçerli; sayının büyüklüğü sentetik verinin hesapsız hacminden (gerçek müşteride açılıştan önce hesapsız kart hareketi sınırlı);
  kullanıcıya görünür not şart; MA listesine (519 ↔ 108.00 sunumu).
- KÂHİN İÇİN OKUMA (DEĞERLENDİR): S215 YENİ kural getirmez — S184 = A'nın (ve S179'un) devirdeki sonucudur: hesapsız POS girişi Devir Kapanışı yapılmadıkça 108.00'da
  kalır, devirde 108.00 bakiyesi yeni yıla AYNEN açılır (kapanış = açılış); Devir Kapanışı yapılmışsa 519'a geçmiştir. Bir önceki bakımın §3 madde 2 sınıfı (hesabı
  atanmamış 102.00 / 108.00 + Devir Kapanışı × devir) bu metinle yeniden denetlenir; senaryolar bu okumaya uymuyorsa farkı ve hangi karardan çıktığını yaz.

## 3. Bu bakımda kâhine eklenecek / denetlenecek SINIFLAR (elle senaryo; beklenenler ELLE, model koşulmadan)

0. S-T2-1 = B: K sonrası Mahsup Et × K öncesi karşı belge (alış ve satış yönü; kısmi mahsup; mahsubun silinmesi) — devirli = devirsiz.

1. S-KD-1: alt defter farkı (toplam 0; cari alt hesapları arasında +/−) kalmış düzeltilmemiş kural farkı → devir REDDİ (neden: kural farkı); "Kilidi Aç → Yeniden
   Kilitle" (dönem kilidinin kaldırılıp yeniden konması — README'deki kilit olaylarıyla) sonrasında fark yoksa devir GEÇER. Fark hiç yokken ret YOK.
2. S-KD-2: kilit K gününde, düzeltme fişi kilit yüzünden K+1'e düşecek → devir REDDİ; kilit geri alınır → fiş K ve öncesi bir tarihle (eski yılda) yazılır → yeniden
   kilit → devir GEÇER; eski yılın kârı fişin tutarı kadar değişir (örnek 3.000). Kilit K'den önce / K'de / hiç yok — üç sınıf.
3. S-KD-3: Excel'den yüklenmiş taksit kartı, Kayıt Tarihi K'den önce, yükleme anı K'den sonra → kart ve defter maddesi Kayıt Tarihi'yle eski yılda; devirde yeni yıla
   açılış (örnek 9.000). Kayıt Tarihi K günü / K+1 günü sınır senaryoları. (Kâhinde "yükleme anı" ayrı bir olay alanıysa modelin onu YOK SAYDIĞI gösterilir.)
4. Ret nedenleri KÜMESİ: aynı anda iki ve üç durdurma durumu (ör. onay bekleyen açılış adayı + düzeltilmemiş kural farkı + S-KD-2 durumu) → ret, küme bütün
   nedenleri içerir; biri giderilince kalanlar; hepsi giderilince devir geçer. Durdurmayan durum kümeye girmez.
5. S215 / S184: §2'deki okuma — Devir Kapanışı yapılmamış hesapsız POS girişi × devir; yapılmış × devir.
KAPSAM DIŞI (bu bakımda YOK): Ödeme Hatırlatma çıktısının devirli = devirsiz olması (ayrı bakım); WhatsApp kâhini; devri uygularken çıkan hatalar (yarıda kesilme,
kilitli dosya, yer yok) ve Devri Geri Al / Devri Yenile redleri — programın uygulama paketine aittir, kâhin bunları bu bakımda modellemez.

6. BAŞ MİMAR KARARI (27.11 15:00 UTC; kullanıcının "devir yarıda kalırsa veya tekrar çalıştırılırsa çift kayıt oluşmasın" sorusu üzerine; ders 40 — kullanıcıya gösterildi, değiştirebilir): AYNI YIL İKİNCİ KEZ DEVREDİLEMEZ — o yılın devri yapılmışsa yeni bir devir REDDEDİLİR (neden: "bu yıl zaten devredildi"; değişiklik yolu Devri Yenile ya da Devri Geri Al); devredilmiş yıldan ÖNCEKİ bir yılın devri de REDDEDİLİR (neden: "sonraki yıl devredilmiş"). Devir → Devri Geri Al → yeniden devir: ikinci devrin sonucu (açılışlar, açık kalemler, kapanış) ilk devirle AYNI — yinelenen açılış / çift açık kalem YOK. Bu iki ret nedeni ret KÜMESİNE (madde 4) öbür nedenlerle birlikte girer.

## 4. Kullanıcı kuralları (AYNEN)
- (14.11) "bana sorun varsa önerilerini uygula" — soru öneriyle yazılır.
- (06.11) "bana soru sorduğunda eğer çok uç durumsa konu; seçeneklere uç durum böyle kalmasında sorun yok maddesi de ekle".
- (20.11) "yapılan işlerde döngüye girmeyelim detaylara boğulup, programı yada kullanıcıyı etkileyemem hususları 2.5.1 sürümüne bırakalım" — bu sürümde: kâhinin iç
  düzeni / belge türü husus kovalanmaz, raporun "SONRAYA" başlığına yazılır.
- (12.11) yaygın muhasebe programları referans alınabilir; bir programın davranışı ancak belgesi okunmuşsa dayanak yazılır.
