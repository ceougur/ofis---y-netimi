# K-D — Muhasebe kâhini devir bakımı: KARAR GİRDİSİ (2.5.1; ana oturum yazdı, 27.11.2026)

Bu dosya kâhin bakımı K-D'nin TEK yeni karar kaynağıdır (CLAUDE.md ders 5, 40, 43). Önceki kararlar kâhinin kendi README'sinde ve README'nin "Kaynaklar"
bölümünde sayılan belgelerdedir (kural kitabı + ekleri, çekirdek planı, devir planının izinli bölümleri). Burada programın kodu, dosya adı, alan adı YOKTUR;
kural dilinde yazılmıştır. Bir kuralın iki okuması çıkarsa KODLAMA — raporda "KULLANICIYA SORULMALI".

## 1. Yeni KULLANICI KARARLARI (27.11.2026; AYNEN)

Kullanıcı 27.11.2026 (AYNEN): "önerini uygula" — aşağıdaki üç sorunun yanıtı (öneri A).

**S-1 = A — önceki yılın kârı / zararı yeni yılda nerede durur, sonraki devirde nereye kapanır?**
- Devirde 590 Dönem Net Kârı / 591 Dönem Net Zararı yeni yıla AYNEN açılır (devir planı §11.1 aynen; "her bilanço hesabı kapanış = açılış" değişmezi korunur).
- Yeni yılın Bilanço'sunda bu tutar "Dönem Net Kârı (Zararı)" kaleminde GÖSTERİLMEZ; "Geçmiş Yıllar Kârları (Zararları)" kaleminde ayrı bir satırda gösterilir:
  "Önceki Yıl Kârı — Dağıtılmamış (<yıl>)" (zararda "Önceki Yıl Zararı (<yıl>)"). "Dönem Net Kârı (Zararı)" kaleminde yalnız içinde bulunulan yılın sonucu durur.
- Bir SONRAKİ devrin kapanışında program ÖNCE 590'daki önceki yıl tutarını 570.<yıl>'a (591'deki tutarı 580.<yıl>'a) aktarır ("Önceki Yıl Sonucu Fişi (<yıl>)" — kitap
  EK-1 M4 / EK-2 S26 sırasıyla, eskiden yeniye), SONRA o yılı kapatır (yeni 590 / 591 yalnız kapanan yılın sonucudur).
- Örnek (kuruşsuz): 2026 kârı 100.000; 31.12.2026 devri; 2027 kârı 80.000. 2027 içinde Bilanço: Geçmiş Yıllar 100.000 ("Önceki Yıl Kârı — Dağıtılmamış (2026)"),
  Dönem Net Kârı 80.000; özkaynak toplamına katkı 180.000. 31.12.2027 devri: önce B 590 / A 570.2026 100.000; sonra 2027 kapanışı; 2028 açılışı 570.2026 = 100.000,
  590 = 80.000.

**S-2 = A — "Açılış Olabilir" listesinde onay bekleyen kayıt varken devir yapılabilir mi?**
- Yapılamaz: ön denetim devri DURDURUR ("Açılış Olabilir Kayıtları Onaylayın"). Kayıt onaylanırsa açılış sayılır (karşılığı 519), reddedilirse o yılın geliri olur
  (KG-16 = A aynen). Kâhin: onay bekleyen aday varken `devir` olayı REDDEDİLİR (neden: bekleyen açılış adayı); aday karara bağlandıktan sonra devir geçer.
- Örnek: "Açılış bakiyesi" açıklamalı 5.000'lik eski Borç Yaz onay bekliyor → devir reddi; onay → 519'da 5.000 açılış, devir geçer; ret → 2026 geliri 5.000 artar, devir geçer.

**S-3 = A — düzeltilmemiş "Kural Değişikliği Farkı" varken devir yapılabilir mi?**
- Yapılamaz: ön denetim devri DURDURUR ("Önce Kural Farkı Düzeltme Fişi'ni yazın"). Düzeltme fişi kapanan yılın İÇİNDE yazılır (KG-15 = A, EK-1 M7: fark aynı yıldaysa
  eski hesabın tersiyle); kapanan yılın kârı düzeltilmiş olarak kapanır. Kâhin: düzeltilmemiş fark varken `devir` REDDEDİLİR; düzeltme fişinden sonra geçer.
- Örnek: eski kuralla kilitlenmiş dönemde açılış çeki 3.000 gelire (602) yazılmış; yeni kural 519. Düzeltme fişi B 602 / A 519 3.000 → 2026 kârı 3.000 azalır; sonra devir.

## 2. BAŞ MİMAR KARARLARI (27.11.2026; kullanıcıya gösterildi — önceki kararların devirdeki sonucu; yeni para kuralı DEĞİL)

Genel ölçüt (devir planı ve kitap §6): **DEVİRLİ = DEVİRSİZ** — devir şirketin durumunu değiştirmez; aynı olaylar devirsiz ve aynı kilitle koşulduğunda bakiye,
gecikmiş, kalan ve 1–5 sınıfı hesap bakiyeleri aynıdır.

1. "Borç ve Alacakları Aktar" seçeneğinde devrin Borç Toplamı ve Alacak Toplamı satırları Tek Yükümlülük Kuyruğu'na girmeden ÖNCE birbiriyle netleşir; kuyruğa yalnız
   net kalan girer. Sonuç: "Borç ve Alacakları Aktar" ile "Sadece Bakiyeyi Aktar" arasında gecikmiş, kalan ve bakiye AYNI (fark yalnız ekstredeki satır görünümünde —
   devir planı §11.2). Alacak Toplamı satırı, K'den önce vadesi gelmiş açık bir kalemi KAPATMAZ.
2. Vadesiz açık kalemin (vadesiz fatura, vadesiz Borç Yaz, karşılıksız evrak borcu) devir satırındaki vadesi asıl BELGE GÜNÜDÜR (EK-1 M2 "kendi vadesiyle" + genel
   ölçüt): gecikmiş tutarı ve gecikme günü devirden önce neyse devirden sonra odur.
3. Ödeme Sözü olan açık kalemde söz, devir satırına taşınır (takvim ve vade görünümü devirli = devirsiz).
4. Kapalı / ödenmiş taksit kartı yeni yılda kalır ve K'ye kadar ödenenler için TEK açılış alır; yeni yılda tahsilatsız açık kart gibi görünmez.
5. Yeni yıl dosyasında K ve öncesi tarihli defter maddesi YOKTUR: yeni yılda kalan eski tarihli kayıtların (açık / kapalı taksit kartı, Excel'den yüklenmiş kart, açık
   şüpheli kaydı, açık evrak, bekleyen POS satışı) etkisi yalnız K+1 tarihli devir açılış satırlarından gelir.
6. Devir tabanı: K ve öncesine hiçbir yazım yapılamaz (dönem kilidi kaldırılsa da); Silinenler'den K ve öncesi tarihli kayıt geri alınamaz.
7. Devir planında açık fatura için G2 ile G3 çelişirse G2 (AYRI AÇIK KALEM) geçerlidir.

## 3. Bu bakımda kâhine eklenecek EKSİK SINIFLAR (yalnız sınıf adı + dayanak; kural metni dayanağın kendisinden okunur)

Kâhinde devir olayları ve senaryoları var; aşağıdaki sınıflar devir senaryolarında hiç geçmiyor. Her sınıf için EN AZ bir elle senaryo (beklenenler ELLE, model
koşulmadan), gerekiyorsa model kuralı, öz test ve mutant:
1. Kredi (300.NN) devri — kitap M-06 / N-09, §6.4.
2. Hesabı atanmamış 102.00 / 108.00 bakiyesi ve "Devir Kapanışı" yapılmış hesap × devir — README'deki S179, S184, S215 kararları + kitap §6.2.
3. "Açılış Olabilir" onay bekleyen aday × devir — KG-16 = A + yukarıda S-2 = A.
4. Kural Değişikliği Farkı × devir — KG-15 = A, EK-1 M7 + yukarıda S-3 = A.
5. Excel'den yüklenmiş taksit kartı açıkken devir — KG-5 = A; devir planı G3 "kart kalır" + yukarıda §2 madde 5.
6. Kapalı / ödenmiş taksit kartı × devir — yukarıda §2 madde 4; EK-1 M2 değişmezi.
7. Değersiz Alacak (kitap J-05) K'den önce × devir — EK-1 M13; G3 (kapanmış şüpheli kaydı yeni yıla taşınmaz).
8. K ve öncesi kayıtta silme / iptal / düzenleme × devir; yeni yılda Silinenler'den K öncesi kaydı geri alma reddi — yukarıda §2 madde 6; kitap R-04.
9. e-SMM / gelen SMM ve Serbest Meslek / İşletme Hesabı Defter Türü × devir — arşiv kendi Defter Türü'nü taşır; yeni yılda tür değişse de arşiv değişmez.
10. Cari türü değişimi × devir — kitap G-2.
11. Ödeme Sözü olan açık kalem × devir — yukarıda §2 madde 3; README'deki S67, S69.
12. Devri Geri Al → yeniden devir — devir planı §8 madde 11 (sonuç ilk devirle AYNI).
13. İkinci yıl devri (önceki yılın 590 / 591'i) — yukarıda S-1 = A.
14. 691 ≠ 0 ile kapanış — EK-2 S40 (691, 690'a DEĞİL 692'ye kapanır).
15. Vadesiz açık kalem × iki devir seçeneği × K'de gecikmiş kalem — yukarıda §2 madde 1 ve 2 (var olan senaryolar kapsıyorsa yalnız denetimi göster).
KAPSAM DIŞI (bu bakımda YOK): Ödeme Hatırlatma çıktısının devirli = devirsiz olması (ayrı karar bekliyor); WhatsApp kâhini.

## 4. Kullanıcı kuralları (AYNEN)
- (14.11) "bana sorun varsa önerilerini uygula" — soru öneriyle yazılır.
- (06.11) "bana soru sorduğunda eğer çok uç durumsa konu; seçeneklere uç durum böyle kalmasında sorun yok maddesi de ekle".
- (20.11) "yapılan işlerde döngüye girmeyelim detaylara boğulup, programı yada kullanıcıyı etkileyemem hususları 2.5.1 sürümüne bırakalım" — bu sürümde: kâhinin iç
  düzeni / belge türü husus kovalanmaz, raporun "SONRAYA" başlığına yazılır.
- (12.11) yaygın muhasebe programları referans alınabilir; bir programın davranışı ancak belgesi okunmuşsa dayanak yazılır.
