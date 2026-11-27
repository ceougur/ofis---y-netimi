# Ödeme Hatırlatma — "Kime, Kaç Kez" İlke Taslağı (2.5.1, Ç5-C)

> **ONAYLANDI — KULLANICI 27.11.2026 12:01 UTC (AYNEN: "ÖNERİLERİNİ UYGULA"): aşağıdaki "YENİ — SORU" maddelerinin HEPSİNDE A şıkkı KARARDIR (S-C5C-1 … S-C5C-10 = A); "ÖNERİ UYGULANIR" maddeleri aynen; 2.2'deki "kaydı açık" okuması onaylandı. BAŞ MİMAR EKLERİ (kullanıcıya gösterildi): S-C5C-1 için önizlemede "vadesi yazılmamış kalem yüzünden listeye giren N kişi" bilgi satırı; S-C5C-9 için devrin ön denetiminde "N kişilik gönderim durdurulacak" uyarısı.**
> Eski durum satırı: TASLAK — KULLANICI ONAYINA (ders 45: dış servise giden, durum tutan özellikte "kime kaç kez" önce planda yazılır, onaylanır; son adayda yeni kural girmez).
> Hazırlayan: plan ajanı P-Ç5C (27.11.2026). Kod ve test YAZILMADI. Sayılar programın kendi ürettiği büyük deneme verisinden (1. şirket, 1.484 cari, bugün = 08.10.2026);
> ayrıntı ve dosya / satır `docs/devir/2.5.1-DEVAM/pc5c-rapor.md`.
>
> İşaretler: **KARARLI** (karar no + karar metni AYNEN) · **İLKEYLE** (genel ilkenin hangi maddesiyle; soru değil) · **YENİ — SORU** (A / B, uç durumsa C; öneri + örnek sayı;
> yanıta kadar ne kodda ne kâhinde kesinleşir) · **ÖNERİ UYGULANIR** ("kime kaç kez" ve para kuralı dışı; kullanıcının 14.11 "önerilerini uygula" kuralıyla öneri uygulanır, değiştirilebilir).
>
> GENEL İLKE (31.10, AYNEN): "(1) kesin ALMADIYSA sayılmaz (teslim yok; iptal / geri yükleme / taşıma / sıfırlama ile duran); (2) ALMIŞ OLABİLİRSE (Sonucu Belirsiz) elenir, tek yol
> işteki onaylı Yine de Gönder; (3) ALDIYSA aynı dönemde elenir, dönem eşliğinde şüphede AYNI dönem; (4) ÇIKMAZ yok — elenen her kişinin bir gönderme yolu kalır; (5) taşınan / geri
> yüklenen veride aynı bilgisayardaki kurallar. İlke iki okumaya izin vermezse yine sorulur."

## Değişikliğin özü (kullanıcıya gösterilecek ana sayı)

Bugün Ödeme Hatırlatma yalnız **taksit kartlarının** gecikmişine bakıyor; 2.5.1'de **cari kartındaki "Gecikmiş Borç"** neyse ileti de o olur, kime gideceği de ona göre.
- Örnek 14 carilik deneme (her durum bir cari, programın kendi ekranlarından kuruldu): bugün 6 kişiye gidiyor, **bunların 4'ü yanlış** (bakiyesi sıfır olan, bize alacaklı olan, icradaki,
  ödeme sözü vermiş). Yeni kuralla bu 4'ü çıkar; faturası, borç kaydı ya da kapatılmış kartı gecikmiş **3 kişi girer** (vadesiz fatura ve "Diğer" türü sorularının yanıtına göre +2).
  Bir caride tutar 600 TL'den 1.100 TL'ye çıkar (taksit + gecikmiş fatura).
- Büyük deneme verisinde (1.484 cari): kişi sayısı aynı (848), ama iletideki toplam tutar **68,1 milyon TL'den 157,0 milyon TL'ye** (2,3 kat) çıkar; 742 kişide tutar artar, 106 kişide azalır;
  848 kişinin hepsinde "en eski vade" tarihi değişir.

---

## 0. "Nasıl bozulur?" (önce yazıldı; her satır bir maddeye bağlı)

| # | Nasıl bozulur | Madde |
|---|---|---|
| N1 | Faturası / Borç Yaz kaydı gecikmiş ama taksit kartı olmayan müşteri hatırlatma ALMAZ (bugünkü durum) | 1.1 |
| N2 | Hatırlatmadaki tutar cari kartındaki "Gecikmiş Borç"tan farklı çıkar | 3.1 |
| N3 | Bakiyesi sıfır ya da bize alacaklı kişiye "vadesi geçmiş borcunuz var" gider | 2.4 |
| N4 | Tedarikçiye (bize avans borçlu) hatırlatma gider | 2.1 |
| N5 | İcra / davadaki (şüpheli alacaklı) müşteriye otomatik hatırlatma gider | 2.2 |
| N6 | Ödeme sözü vermiş müşteriye söz günü gelmeden hatırlatma gider | 2.3 |
| N7 | Söz verilen kalem dışındaki başka bir kalem gecikince hatırlatma gider | 2.3 |
| N8 | Dün kesilen vadesiz (peşin) satış faturası bugün "gecikmiş" sayılıp hatırlatma gider | 1.3 |
| N9 | {{3}} (en eski vade) kısmen ödenmiş ya da şüpheliye alınmış kalemin vadesini gösterir | 3.2 |
| N10 | Kapatılmış taksit kartının "Borçta Kalsın" kalanı hatırlatmada görünmez ya da iki kez sayılır | 3.3 |
| N11 | Elle seçilen şüpheli müşteriye şüpheli tutar da yazılır | 3.4, 6.1 |
| N12 | Kuyruktayken müşteri borcunu öder ama ileti eski tutarla gider | 5.1, 5.2 |
| N13 | Kuyruktayken ödeme sözü verilir ama ileti yine gider | 5.3 |
| N14 | Kuyruktayken şüpheli kaydı açılır ama ileti gider | 5.4 |
| N15 | Kuyruktayken cari tedarikçiye çevrilir / silinir / pasif yapılır ama ileti gider | 5.5, 5.6 |
| N16 | "Yine de Gönder" eski (donmuş) tutarı yeniden gönderir | 6.3 |
| N17 | Elle seçimin programda bir yolu yoktur; "istenirse elle seçilir" kararı uygulanamaz (çıkmaz, ilke 4) | 6.1 |
| N18 | Aynı gün iki hatırlatma gider (biri eski sürümden, biri yeni sürümden, tutar farklı) | 7.1 |
| N19 | Güncellemeden sonraki ilk gönderimde alıcı sayısı habersiz katlanır | 7.2 |
| N20 | Güncelleme anında kuyrukta bekleyen eski iş eski kuralla gider | 7.3 |
| N21 | Devir sırasında süren gönderim yarıda kalır ya da yeni yıl dosyasında yeniden başlar (iki ileti) | 8.1 |
| N22 | Devri Geri Al / yedekten geri yükleme sonrası aynı gün aynı kişiye ikinci hatırlatma gider | 8.2, 8.3 |
| N23 | Devir sonrası açık kalemlerin vadesi devir gününe kayar, gecikmiş sıfırlanır ya da büyür | 8.1 |
| N24 | Arşivdeki (geçmiş yıl) dosyadan eski bakiyelerle hatırlatma gönderilir | 8.4 |
| N25 | İki şirkette cari olan kişiye aynı gün iki hatırlatma gider | 9.1 |
| N26 | Elle (wa.me) "Geciken Taksit" metni başka bir tutar yazar | 3.5 |
| N27 | Birden çok eleme nedeni olan kişide neden adı ekranlar arasında farklı çıkar | 2.5 |
| N28 | Önizlemede kaç kişinin neden elendiği görünmez; etiketli kişi kaybolur | 2.5, 6.1 |
| N29 | Taksit kartı penceresiyle cari kartının taksit özeti ve yeni kart sınırı farklı borç gösterir | 3.6 |
| N30 | Gece yarısını geçen (Sınır Nedeniyle Bekleyen) işte tutar ve gün değişir | 5.2, 4.1 |

---

## 1. Kime Gider

1.1 **KARARLI** — Gecikmiş borcu olan cari, borcun kaynağı ne olursa olsun (fatura, taksit, Borç Yaz, açılış, karşılıksız evrak, kapatılmış kartın borçta kalanı).
Kaynak: KULLANICI KARARI 22.11 06:32 (AYNEN: "Ç5-C yide 2.5.1 e bırakalım, haftalık limit onu bitirmeyede yetmez. kalan işi izole edelim"; iş listesi metni: "Ödeme Hatırlatma tutarlarının
ve elemesinin Tek Yükümlülük Kuyruğu'na geçmesi"); 2.5.1 plan taslağı §2 (kullanıcı 27.11 "önerilerini uygula"): "hatırlatma tutarı cari kartının Gecikmiş Borç'uyla aynı";
KULLANICI KARARI 05.11 17:16 "hepsi A" (B1 fatura dahil).

1.2 **KARARLI** — "Gecikmiş" = vadesi bugünden önce olan açık borç (vade günü gecikmiş değildir, tatil kaydırması yok). Kaynak: M1f (gösterilen BAŞ MİMAR KARARI) ve S1 = A.

1.3 **YENİ — SORU S-C5C-1 (kör nokta: vadesiz borç ertesi gün hatırlatmaya girer)** — Vadesi yazılmamış (peşin) fatura / Borç Yaz, kuralı gereği ERTESİ GÜN gecikmiş sayılır (S1 = A).
Bugün bu kalemler hatırlatmaya hiç girmiyor; yeni kuralla açık hesapla satılan her vadesiz faturanın müşterisi ertesi gün hatırlatma listesine girer.
- **A (öneri):** karar aynen — hatırlatma cari kartındaki Gecikmiş Borç'la aynı kişilere gider; vadesiz kalem ertesi gün girer. Gerekçe: "tutar = Gecikmiş Borç" kararı tek sayı ister;
  kullanıcı vade yazarak (ya da carinin Vade Günü ile) erken hatırlatmayı önler.
- **B:** hatırlatma yalnız VADESİ YAZILMIŞ kalemlerde; vadesiz kalem cari kartında gecikmiş görünür ama hatırlatmaya girmez (tutar Gecikmiş Borç'tan küçük olabilir — 22.11 kararından sapma).
- Örnek sayı: örnek 14 carilik denemede dün kesilmiş 750 TL'lik vadesiz fatura → A: bugün hatırlatma "750,00 TL, vade 07.10.2026" ile gider; B: gitmez (kart 750 gecikmiş gösterir).

## 2. Kime Gitmez (etiketiyle görünür; elle seçim §6)

2.1 **KARARLI** — Tedarikçiye hatırlatma gitmez. Kaynak: S93 = A (AYNEN: "TEDARİKÇİYE verilen avans (tedarikçi bize borçlu) vadesi geçince 'Gecikmiş Borç' sayılsın mı — A öneri (kodlanan):
evet …; tedarikçiye Ödeme Hatırlatma gitmez (Ç5-C süzer)"; YANITLANDI 06.11 19:33).
- **YENİ — SORU S-C5C-2 (Diğer türü):** S93 yalnız "tedarikçi" der. Türü **Diğer** olan cari (ortak, personel, kurum …) gecikmiş borçluysa: **A (öneri):** gider (yalnız Tedarikçi elenir; Diğer
  müşteri gibi) / **B:** yalnız Müşteri türüne gider (Diğer de elenir, neden "Müşteri Değil"). Örnek sayı: örnek denemede Diğer türlü cari 300 TL gecikmiş → A gider / B elenir (büyük veride Diğer türünde gecikmiş borç yok).
- **YENİ — SORU S-C5C-3 (tedarikçiyi elle seçmek):** **A (öneri):** hiçbir yoldan gitmez (neden "Tedarikçi"; yol Ekstre — İLKEYLE 4 "çıkmaz yok", Ekstre her zaman açık) / **B:** elle seçilirse
  gider (§6.1 ile). Örnek: tedarikçiye verilmiş 1.000 TL avans kartta "Gecikmiş Borç 1.000" görünür; A ile hiçbir yoldan hatırlatma gitmez.

2.2 **KARARLI** — Şüpheli alacak kaydı (icra / dava) açık müşteri otomatik listeye girmez. Kaynak: S7 = A (AYNEN: "'Müşteri otomatik listeye girmesin': şüpheli alacak kaydı (icra / dava) açık
olan müşteriye otomatik Ödeme Hatırlatma gitmez; ekranda 'Şüpheli Alacağı Var' etiketiyle görünür, istenirse elle seçilir (iletide şüphelisiz gecikmiş tutar yazar)").
"Kaydı açık" = Şüpheli Alacaklar'da kalanı olan kayıt (kayıt kapanınca — tahsil, çıkarma, değersiz — etiket kalkar, kişi normal kurala döner). Örnek: kartı 600 TL gecikmiş, 300 TL'si Şüpheli Alacağa alınmış müşteri — bugün 600 TL'lik hatırlatma GİDİYOR (karar uygulanmamış); yeni kuralla otomatik gitmez, elle seçilirse "300,00 TL, vade 05.10.2026".

2.3 **KARARLI** — Ödeme Sözü süren müşteri otomatik listeye girmez; söz günü de girmez, söz geçince (ertesi takvim günü) girer; söz carinin BÜTÜN borcunu kapsar.
Kaynak: S52 = A (AYNEN: "vadesi geçmiş borca ileri tarihli Ödeme Sözü → borç gecikmiş sayılır, söz tarihine kadar otomatik hatırlatmaya girmez ('Ödeme Sözü Var')"), S72 = A (AYNEN: "Ödeme
Sözü'nün günü de cari otomatik hatırlatma listesine girmez; söz geçince girer"), S73 = A (AYNEN: "söz carinin bütün borcunu kapsar; söz sürerken başka kalemi gecikse de cari listeye girmez"),
K9-1 (gösterilen BAŞ MİMAR KARARI: "söz geçti" = söz tarihinin ertesi TAKVİM günü). Soru metni (S-Ç5-6 A): "'Ödeme Sözü Var' etiketiyle görünür, istenirse elle seçilir". Örnek: 600 TL gecikmiş taksiti + 400 TL gecikmiş borç kaydı olan, 20.10'a söz vermiş müşteri — bugün 600 TL'lik hatırlatma GİDİYOR; yeni kuralla 21.10'a kadar otomatik gitmez, elle seçilirse 1.000 TL. Söz günü bugün olan müşteri de gitmez.

2.4 **KARARLI** — Bize alacaklı (net borcu olmayan) kişiye hatırlatma gitmez. Kaynak: karar (5) 05.11 21:30 ("gecikmiş tutar carinin net borcunu aşmaz (alış faturası düşülür) … bize alacaklı
kişiye hatırlatma gitmez"). Tek borç sırasında gecikmiş zaten net borçtan büyük olamaz → ayrı ad gerekmez: neden "Gecikmiş Borç Yok" (**ÖNERİ UYGULANIR**; ayrı bir "Net Borcu Yok" adı
yok). Örnek: kartı 600 TL gecikmiş ama başka kaydı sonrası 100 TL alacaklı müşteri — bugün "600,00 TL … bakiyeniz 100,00 TL (Alacaklı)" GİDİYOR; yeni kuralla gitmez. Bakiyesi sıfırlanmış (karta bağlanmadan tahsilat yapılmış) müşteri de bugün 600 TL alıyor, yeni kuralla almaz.

2.5 **ÖNERİ UYGULANIR** — Birden çok neden olan kişide TEK neden, her yerde aynı sıra: Cari Silinmiş → WhatsApp Mesajı İstemiyor → Pasif Cari → numara → **Tedarikçi** → **Şüpheli Alacağı Var** →
**Ödeme Sözü Var** → Gecikmiş Borç Yok → Zaten Kuyrukta → Sonucu Belirsiz → Daha Önce Gönderildi. (Kime gittiği sırayla değişmez — hepsinde ileti gitmez; sıra yalnız gösterilen ad.)
Önizlemede "Elenenler ve Nedenleri" bu adlarla sayılır; etiketli kişiler listede görünür kalır. "Daha Önce Gönderildi" uyarısının sayısına bu nedenlerle elenen kişi girmez (Y20-17 düzeni).

## 3. Hangi Tutar ve Hangi Vade

3.1 **KARARLI** — {{4}} = cari kartındaki **Gecikmiş Borç** (şüpheli alacağa alınan kısım hariç). Kaynak: 1.1'in kaynakları. Bugünkü "yalnız taksit kartlarının gecikmişi" kalkar.

3.2 **KARARLI** — {{3}} = en eski gecikmiş AÇIK kalemin vadesi (taksit değil; fatura, Borç Yaz … de). Kaynak: WhatsApp planı §7a 20 ("hatırlatma {{3}} en eski gecikmiş vade") + 1.1.
**ÖNERİ UYGULANIR:** kısmen ödenmiş kalem açıktır (vadesi sayılır); şüpheliye alınmış kalemin vadesi sayılmaz (iletide şüpheli kalem yok — S7 "şüphelisiz gecikmiş").

3.3 **KARARLI** — Kapatılmış taksit kartının "Borçta Kalsın" kalanı kendi vadesinde gecikmiş sayılır (iki kez sayılmaz); 2.5.0'dan önce kapatılmış kartın kalanı borç değildir.
Kaynak: S220 = A (YANITLANDI 20.11 13:39, kullanıcı AYNEN "önerilerini uygula"), karar (6) ("önceden kapatılmış kartlar olduğu gibi kalır"). Örnek: 08.10'da Borçta Kalsın ile kapatılan kartın 05.09 ve 05.10 taksitleri (600 TL) — bugün hatırlatma GİTMİYOR (kart kapalı); yeni kuralla 600 TL, vade 05.09.

3.4 **KARARLI** — Elle seçilen şüpheli caride {{4}} = şüphesiz gecikmiş, şüpheli kalemler hariç net borçla sınırlı; şüphesiz gecikmiş yoksa "Gecikmiş Borç Yok" ile elenir.
Kaynak: S17 = A (AYNEN: "elle seçilen şüpheli alacaklı caride iletideki şüphesiz gecikmiş tutar, şüpheli kalemler HARİÇ net borçla sınırlanır"), S7-a = A (AYNEN: "şüpheli alacak kaydı açık
müşteri ELLE seçilse de şüphesiz gecikmiş borcu yoksa 'Gecikmiş Borç Yok' ile elenir (ileti gitmez)"). Not: tek borç sırasının Gecikmiş Borç'u zaten bu sayıdır (ayrı hesap yok).
- **YENİ — SORU S-C5C-10 (uç; {{5}} "güncel bakiye")** — elle seçilen şüpheli caride iletinin bakiye satırı: **A (öneri):** carinin bütün bakiyesi (kartta görünen, şüpheli dahil — borcun tamamı) / **B:** şüpheli hariç bakiye / **C:** uç durum böyle kalsın (BİLİNEN SINIR; A gibi). Örnek: 900 TL bakiyeli, 300 TL'si şüpheli caride A "900,00 TL", B "600,00 TL"; {{4}} iki okumada da 300 TL.

3.5 **ÖNERİ UYGULANIR** — Elle (wa.me) gönderimdeki "Geciken Taksit" metni ve elle ekstre metnindeki "Vadesi geçen: N taksit" de aynı sayıyı yazar: "{Vadesi Geçen}" = "N kalem (tutar)";
şablonun adı "Gecikmiş Borç". (Kullanıcının kendi yazdığı metinlerde değişken adı aynı kalır.)

3.6 **YENİ — SORU S-C5C-4 (S260'ın 2.5.1'deki yanıtı; para / taksitlendirme sınırı)** — S260 = B (BİLİNEN SINIR; kullanıcı 22.11 18:31 AYNEN: "soruna önerini uygula b şıkkı yani") "kartın kuyruğa
geçişi Ç5-C ile 2.5.1'de" dedi. Örnek (S260 metni): F 900, kart K 600, cari tahsilatı 600 (karta bağlanmadan) → kuyrukta K 300 kalan, bakiye 300; sonra F2 600 → bugün 600'lük yeni kart
REDDEDİLİYOR ("taksitlendirilebilecek borç 300"), yalnız 300'lük kart açılıyor.
- **A (öneri):** 2.5.1'de sınır tek borç sırasından — 600'lük kart açılır. Ödeme Hatırlatma ile AYNI pakette değil, ayrı küçük tur (taksit kartı dosyası, cari kâhini; hatırlatmanın kime / kaç
  kezine dokunmaz).
- **B:** bugünkü gibi kalsın (kartın kendi hesabı; S118 = B ile aynı yön), BİLİNEN SINIR sürer.
- **C:** uç durum böyle kalsın (BİLİNEN SINIR).

## 4. Kaç Kez (dönem)

4.1 **KARARLI (bugünkü kural, değişmez)** — Hatırlatmanın dönemi GÜNDÜR: aynı cariye aynı gün ikinci hatırlatma "Daha Önce Gönderildi" uyarısıyla sorulur (varsayılan "Bunları Çıkar", "Yine de Gönder"
ile gider); ertesi gün serbest. Kaynak: BAŞ MİMAR KARARI GRUP 5 ★5 (2.4.8; "aynı gün ikinci hatırlatma sorulur, ertesi gün serbest") + İLKEYLE 3. Süren hatırlatma işi varken yenisi "Zaten Kuyrukta"
(günsüz). Tutarın değişmesi dönemi değiştirmez (İLKEYLE 3: aynı kişiye aynı dönemde iki ileti yok).
4.2 **KARARLI** — Genel ilkenin beş maddesi ve 01.11 06:28 sekiz madde AYNEN; Ç5-C bunlara dokunmaz:
(1) kesin ALMADIYSA sayılmaz → Atlandı / iptal / geri yükleme ile duran hatırlatma "almış" sayılmaz; (2) ALMIŞ OLABİLİRSE elenir → Sonucu Belirsiz kişi yeni gönderimde elenir, tek yol işteki
"Yine de Gönder"; (3) ALDIYSA aynı gün elenir; (4) ÇIKMAZ yok → her eleme nedeninin yolu §2 ve §6'da yazılı; (5) taşınan / geri yüklenen veride aynı kurallar (§8).
4.3 **İLKEYLE 1** — Tedarikçi / Şüpheli Alacağı Var / Ödeme Sözü Var / Gecikmiş Borç Yok ile elenen ya da "Atlandı" olan kişi o gün hatırlatma ALMAMIŞ sayılır; aynı gün koşul kalkarsa
(ör. söz silinir) yeni gönderimde gider.

## 5. Kuyruktayken Durum Değişirse ("gönderim anı" = ileti hazırlanmadan hemen önceki denetim)

5.1 **KARARLI** — Borcun tamamını ödedi → "Atlandı — Gecikmiş Borç Yok". Kaynak: WhatsApp planı §7a 2 ("eleme denetimleri gönderim anında"), İLKEYLE 1.
5.2 **KARARLI** — Bir kısmını ödedi / yeni kalem gecikti → ileti GİTTİĞİ ANDAKİ tutarla gider; o an hazırlanan içerik sonra donar (Meta Bekletti'nin 24 saat sonraki 2. denemesi aynı içerikle).
Kaynak: KULLANICI KARARI 01.11 10:40 "Gittiği anki içerik" (AYNEN: "günlük sınır yüzünden ertesi güne kalan kişinin ekstresi ve bakiyesi iletinin GERÇEKTEN gittiği anda hazırlanır (o andaki güncel
bakiye …), hazırlanan içerik sonra donar (Meta Bekletti 2. denemesi aynı içerikle)"); S29 = A, S34 = A (gönderim anındaki tutar).
5.3 **YENİ — SORU S-C5C-5 (kuyruktayken Ödeme Sözü verildi)** — S52 / S72 "otomatik hatırlatmaya girmez" der, ANI söylemez (şüpheli için S7-b söylüyor).
- **A (öneri):** S7-b gibi: gönderim anında söz sürüyorsa "Atlandı — Ödeme Sözü Var" (elle seçilmişse gider); Duraklatıldı → Devam Et, Sınır Nedeniyle Bekleyen, Meta Bekletti'nin 2. denemesi
  ve Başarısızları Yeniden Dene de aynı denetimden geçer. Yol: söz geçince yeni gönderim ya da elle seçim (ilke 4).
- **B:** başlatmadaki seçimle gider (söz yalnız başlatmada eler).
5.4 **KARARLI** — Kuyruktayken şüpheli kaydı açıldı (elle seçilmemiş) → gönderim anında "Atlandı — Şüpheli Alacağı Var"; Yine de Gönder'den sonra açılsa da. Kaynak: S7-b = A (AYNEN: "toplu
gönderim kuyruktayken şüpheli alacak kaydı açılan, elle seçilmemiş müşteri gönderim anında atlanır ('Şüpheli Alacağı Var')"), S22 = A (AYNEN: "işteki Yine de Gönder basıldığında şüpheli kaydı
yoktu, iş gönderim beklerken kayıt açıldı → S7-b gibi gönderim anında 'Atlandı — Şüpheli Alacağı Var'; yol kalır (kayıt açıkken yeniden Yine de Gönder basılırsa S16 ile şüphesiz tutarla gider)").
5.5 **YENİ — SORU S-C5C-6 (kuyruktayken türü Tedarikçi yapıldı; uç durum)** — **A (öneri):** gönderim anında "Atlandı — Tedarikçi" (2.1 ile aynı denetim) / **B:** başlatmadaki türle gider /
**C:** uç durum böyle kalsın (BİLİNEN SINIR; B gibi davranır).
5.6 **KARARLI** — Silindi / pasif yapıldı / "WhatsApp Mesajı İstemiyor" işaretlendi / telefonu silindi → gönderim anında "Atlandı" (bugünkü kural, değişmez; WhatsApp planı §7a 2).

## 6. Elle Seçim ve Yine de Gönder

6.1 **YENİ — SORU S-C5C-7 (elle seçimin yolu; S7 ve S52'nin "istenirse elle seçilir"i)** — Bugün programda kişi başı "yine de ekle" yolu YOK; bütün gönderimler Cari Listesi'nde seçilenlerden
başlar ve aynı elemeden geçer. Karar "istenirse elle seçilir" dediği için yol gerekir (ilke 4).
- **A (öneri):** Önizlemede "Şüpheli Alacağı Var" / "Ödeme Sözü Var" ile elenen her kişinin satırında **"Yine de Ekle"** kutusu; işaretlenen kişi ELLE SEÇİLMİŞ sayılır (iş üzerinde iz kalır;
  Devam Et ve aynı işin yeniden denemesi bu izi taşır). Tedarikçi (2.1), Gecikmiş Borç Yok, Zaten Kuyrukta, Sonucu Belirsiz, Daha Önce Gönderildi bu kutuyla aşılmaz (kendi yolları var).
- **B:** yalnız cari kartından TEK cari için açılan gönderim elle sayılır; toplu seçimde etiketli kişi hep elenir.
- Örnek sayı: örnek denemede etiketli 2 kişi (şüpheli 300 TL, söz 1.000 TL): A ile önizlemede ikisi de "Yine de Ekle" kutusuyla görünür; B ile yalnız kendi kartından tek tek gönderilebilir.
6.2 **KARARLI** — Elle seçilen şüpheli cariye şüphesiz tutar yazılır, yoksa elenir (3.4). Sonucu Belirsiz işte "Yine de Gönder" basıldığında şüpheli kaydı açıksa ELLE seçim sayılır, ileti
şüphesiz tutarla gider (yoksa elenir), onay penceresinde "Şüpheli Alacağı Var" yazar. Kaynak: S16 = A (AYNEN: "Sonucu Belirsiz iş beklerken şüpheli alacak kaydı açıldıysa 'Yine de Gönder' elle seçim
sayılır; ileti şüphesiz tutarla gider (yoksa elenir); onay penceresinde 'Şüpheli Alacağı Var'"), S23 = A (AYNEN: "… bekleyen iş S16 ile elle sayılır, gönderim anında şüphesiz tutarla gider; yeni iş
açılmaz (F1 'Zaten Kuyrukta' bu duruma uygulanmaz)"), S29 = A, S34 = A.
6.3 **YENİ — SORU S-C5C-8 ("Yine de Gönder"in tutarı; para görünümü)** — Bugün "Yine de Gönder" belirsiz kalan iletinin DONMUŞ içeriğini yeniden gönderir (2.4.8 BAŞ MİMAR KARARI "aynı ileti";
PDF'li Ekstre için konmuştu). S16 / S29 / S34 ise hatırlatmada "gönderim anındaki (şüphesiz) tutarla gider" der → hatırlatmada iki kural çelişiyor.
- **A (öneri):** Ödeme Hatırlatma'da "Yine de Gönder" içeriği gönderim anında güncel tutarla yeniden hazırlar (S16 / S29 / S34 / S37 ile tek kural; hatırlatmada PDF yok); Ekstre'de bugünkü
  "aynı ileti" kuralı aynen. Sonuç: iki ileti de ulaşırsa ikincisi güncel tutarı yazar.
- **B:** donmuş içerik kalır; yalnız şüpheli kaydı açıksa (S16) yeniden hazırlanır.
- Örnek: 10.10'da 1.000 TL'lik hatırlatma Sonucu Belirsiz; 12.10'da müşteri 400 öder, 13.10'da Yine de Gönder → A: "600,00 TL", B: "1.000,00 TL".
6.4 **İLKEYLE 2 + 4** — Elle seçim "Daha Önce Gönderildi" ve "Sonucu Belirsiz"i aşmaz; onların yolu bugünkü gibi (R3 "Yine de Gönder" / işteki "Yine de Gönder").

## 7. Sürüm Geçişi (2.5.0 → 2.5.1)

7.1 **İLKEYLE 3 + 4.1** — Güncelleme günü 2.5.0'dan hatırlatma almış cari, 2.5.1'de aynı gün (daha büyük tutarla da) "Daha Önce Gönderildi" ile sorulur; ertesi gün yeni kuralla serbest.
(Makine defteri güncellemeyle silinmez.)
7.2 **ÖNERİ UYGULANIR (bilgi; kime değişmez)** — Güncellemeden sonraki ilk Ödeme Hatırlatma önizlemesinde tek satır bilgi: "Bu sürümden itibaren hatırlatma, faturası ya da borç kaydı gecikmiş
carilere de gider; bu seçimde N cari yeni." + sürüm notunda aynı cümle.
7.3 **İLKEYLE (WhatsApp planı §7a 2) + S-C5C-5'in yanıtı** — Güncelleme anında kuyrukta bekleyen 2.5.0 işi gönderim anında YENİ kuralla değerlendirilir (tutar tek borç sırasından; şüpheli /
söz / tedarikçi elemesi 5.3–5.5'e göre). Kişiye ikinci ileti doğmaz (aynı iş).

## 8. Devir, Devri Geri Al, Yedekten Geri Yükleme (D6)

8.1 **YENİ — SORU S-C5C-9 (devir anında süren hatırlatma gönderimi)** — Devir yeni yıl dosyasını kopyadan kurar; süren / Sınır Nedeniyle Bekleyen (günlerce sürebilir) toplu iş o sırada ne olur?
- **A (öneri):** devir başlarken o şirketin süren ve duraklatılmış toplu işleri "Durduruldu (Devir)" olur, kendiliğinden sürmez; gönderilmemiş kişiler ALMAMIŞ sayılır (ilke 1), yol yeni gönderim;
  Meta'ya gitmiş iletiler bugünkü gibi sayılır (01.11 (1)).
- **B:** süren / duraklatılmış WhatsApp gönderimi varken devir başlamaz ("Önce gönderimi bitirin ya da iptal edin").
- Devirden SONRA (KARARLI tasarım, D3-D4 §4.7 ve G-tablosu "şirket / cari kimlikleri değişmez → eleme sürer"; D4a kabul "gecikmiş devirli = devirsiz"): açık kalemler kendi vadeleriyle taşınır,
  gecikmiş ve kişi kümesi devirden önceki günle aynı; makine defteri dokunulmaz → aynı gün elemesi sürer.
8.2 **İLKEYLE 1 + 3 + 5** — Devri Geri Al: dönen (devir öncesi) dosyadaki süren işler "Durduruldu (Geri Yükleme)" (kendiliğinden sürmez); devirden sonra giden hatırlatmalar makine defterinde
"almış" → aynı gün elenir, ertesi gün dönen dosyanın borcuyla serbest. (D3-D4 §4.7: makine defteri dokunulmaz; dönen dosyadaki gönderim kayıtları makine defteriyle birleşir.)
8.3 **KARARLI** — Yedekten geri yükleme / başka bilgisayara taşıma: 2.4.8 kuralları aynen (31.10 11:00 "A", 01.11 06:28 (1) ve (3), ilke 5); tutar geri yüklenen dosyanın borcundan.
Devri Yenile gecikmiş tutarı değiştirebilir → İLKEYLE 3 (D3-D4 §4.6: "daha önce giden hatırlatma → genel ilke (3) ALDIYSA aynı dönemde elenir").
8.4 **KARARLI (tasarım; doğrulanacak)** — Arşivden (salt okunur geçmiş yıl) gönderim yok (D5 kabul koşulu "arşivde yazma düğmesi yok"; gönderim kuyruğa yazar).

## 9. İki Şirket

9.1 **KARARLI (bugünkü kural, değişmez)** — Her şirket kendi carisinin kendi borcuyla; "Daha Önce Gönderildi" şirket başına; aynı WABA'yı kullanan iki şirketin günlük sınırı ortak (2.4.8).
İki şirkette cari olan kişiye aynı gün iki şirketten iki hatırlatma gidebilir (farklı firma adı, farklı borç) — Ç5-C bunu değiştirmez; alıcı kümesi büyüdüğü için daha sık görülebilir.
9.2 **KARARLI** — Şirket 002'de de aynı kurallar (kural şirkete göre değişmez).

---

## 10. Soru listesi (TEK iletide sorulacak; ders 43, 45 — yanıta kadar ne kodda ne kâhinde kesinleşir; 5 dk yetkisi YOK)

1. **S-C5C-1** (1.3) Vadesiz fatura / borç kaydı ertesi gün hatırlatmaya girsin mi? A (öneri) evet, kart ile aynı / B yalnız vadesi yazılmış kalem.
2. **S-C5C-2** (2.1) "Diğer" türündeki cariye gitsin mi? A (öneri) gider / B yalnız Müşteri.
3. **S-C5C-3** (2.1) Tedarikçi elle seçilebilsin mi? A (öneri) hayır, hiçbir yoldan / B elle seçilirse gider.
4. **S-C5C-4** (3.6) Yeni taksit kartının açma sınırı (S260) 2.5.1'de tek borç sırasından mı? A (öneri) evet, ayrı küçük turda / B bugünkü gibi / C uç durum böyle kalsın.
5. **S-C5C-5** (5.3) Kuyruktayken söz verilen kişi gönderim anında atlansın mı? A (öneri) evet, "Atlandı — Ödeme Sözü Var" / B başlatmadaki seçimle gider.
6. **S-C5C-6** (5.5) Kuyruktayken tedarikçi yapılan cari? A (öneri) "Atlandı — Tedarikçi" / B gider / C uç durum böyle kalsın.
7. **S-C5C-7** (6.1) "Elle seçim" nasıl yapılır? A (öneri) önizlemede etiketli kişinin satırında "Yine de Ekle" / B yalnız cari kartından tek cari gönderimi.
8. **S-C5C-8** (6.3) "Yine de Gönder"in tutarı? A (öneri) gönderim anındaki güncel tutar / B belirsiz iletinin donmuş tutarı (şüphelide güncel).
9. **S-C5C-9** (8.1) Devir anında süren hatırlatma gönderimi? A (öneri) "Durduruldu (Devir)", gönderilmeyenler almamış sayılır / B gönderim bitmeden devir başlamaz.
10. **S-C5C-10** (3.4 eki; uç) Elle seçilen şüpheli caride iletideki "güncel bakiye" ({{5}}) şüpheli tutarı içersin mi? A (öneri) evet, carinin bütün bakiyesi (kartta görünen) / B şüpheli hariç bakiye / C uç durum böyle kalsın.

Öneriyle uygulananlar (bilgi; kullanıcı değiştirebilir): 2.4 tek ad "Gecikmiş Borç Yok"; 2.5 eleme sırası ve önizleme etiketleri; 3.2 kısmen ödenmiş / şüpheli kalemin vadesi; 3.5 elle (wa.me) metni;
7.2 güncelleme sonrası bilgi satırı.
Yaygın programlar (Mikro, Netsis, Logo, AKINSOFT): bu taslak için belgeleri / ekranları OKUNMADI — dayanak yazılmadı (12.11 kuralı).
