# Ç5-C — Ödeme Hatırlatma: CARİ KÂHİNİ BAKIMI 31 + WHATSAPP KÂHİNİ GÜNCELLEMESİ 21 — KARAR GİRDİSİ (2.5.1; ana oturum yazdı, 27.11.2026)

Bu dosya iki kâhin bakımının TEK yeni karar kaynağıdır (CLAUDE.md ders 5, 40, 43, 45). Kural metni, kullanıcının ONAYLADIĞI ilke taslağıdır:
`docs/devir/C5C-ILKE-TASLAK.md` (TAMAMI izinli ve okunur). Önceki kararlar kâhinin kendi KARARLAR.md / README'sindedir. Burada programın kodu, dosya adı, alan
adı YOKTUR. Bir kuralın iki okuması çıkarsa KODLAMA — raporda "KULLANICIYA SORULMALI" (TOPLU KÂHİN BAKIMI: bulduğun bütün alt durumları BİRLİKTE çıkar; ana oturum
hepsini tek iletide sorar; "kime kaç kez" ve para kuralı soruları beklenir — ders 43, 45).

OKUNMAZ (bağımsızlık): ilke taslağının başında adı geçen plan ajanının RAPORU ve onun yanındaki betik / çıktı / sınıf dosyaları (`docs/devir/2.5.1-DEVAM/pc5c-*`) —
programın kodunu ve dosya / satır adreslerini taşır. Taslağın içindeki "bugün GİDİYOR / GİTMİYOR", "örnek 14 carilik deneme", "büyük deneme verisi (1.484 cari)",
"68,1 → 157,0 milyon" gibi sayılar programın 2.5.0 DAVRANIŞININ ÖLÇÜMÜDÜR, kural kaynağı DEĞİLDİR; beklenenleri SEN kural metninden elle hesapla, farklı çıkarsa
uydurma — farkı ve hangi maddeden çıktığını raporda yaz.

## 1. KULLANICI KARARI (AYNEN)

Kullanıcı 27.11.2026 12:01 UTC (AYNEN): "ÖNERİLERİNİ UYGULA" — ilke taslağı ONAYLANDI (ders 45). Taslaktaki "YENİ — SORU" maddelerinin HEPSİNDE A şıkkı KARARDIR
(S-C5C-1 … S-C5C-10 = A; her sorunun tam metni taslakta, ilgili maddenin altında); "ÖNERİ UYGULANIR" maddeleri aynen; taslak 2.2'deki okuma onaylandı ("şüpheli kaydı
açık" = Şüpheli Alacaklar'da kalanı olan kayıt; kayıt kapanınca — tahsil, çıkarma, değersiz — etiket kalkar, kişi normal kurala döner).
BAŞ MİMAR EKLERİ (kullanıcıya gösterildi): S-C5C-1 için önizlemede "vadesi yazılmamış kalem yüzünden listeye giren N kişi" bilgi satırı; S-C5C-9 için devrin ön
denetiminde "N kişilik gönderim durdurulacak" uyarısı (DURDURMAZ).
Genel ilke (31.10, AYNEN — taslağın başında): "(1) kesin ALMADIYSA sayılmaz (teslim yok; iptal / geri yükleme / taşıma / sıfırlama ile duran); (2) ALMIŞ OLABİLİRSE
(Sonucu Belirsiz) elenir, tek yol işteki onaylı Yine de Gönder; (3) ALDIYSA aynı dönemde elenir, dönem eşliğinde şüphede AYNI dönem; (4) ÇIKMAZ yok — elenen her kişinin
bir gönderme yolu kalır; (5) taşınan / geri yüklenen veride aynı bilgisayardaki kurallar. İlke iki okumaya izin vermezse yine sorulur."

## 2. İŞ BÖLÜMÜ (BAŞ MİMAR KARARI 27.11 11:58 B-1 — kullanıcıya gösterildi; DEĞERLENDİR)

İki kâhin AYRI ajanlardır; birbirinin klasörünü okumaz, yazmaz.
- **CARİ KÂHİNİ (bakım 31) — "KİME / HANGİ TUTAR / HANGİ VADE":** taslak §1 (Kime Gider: 1.1, 1.2, 1.3 = S-C5C-1 A), §2 (Kime Gitmez: 2.1 + S-C5C-2 A + S-C5C-3 A,
  2.2, 2.3, 2.4, 2.5 eleme adları ve sırası), §3 (Hangi Tutar ve Vade: 3.1, 3.2 + öneri, 3.3, 3.4 + S-C5C-10 A, 3.5, 3.6 = S-C5C-4 A), §6.1–6.2'nin TUTAR yanı (elle seçilen
  şüpheli / söz carisinde iletideki tutar ve bakiye), §8.1'in son paragrafı (devirden sonra gecikmiş ve kişi kümesi devirden önceki günle AYNI). Çıktı: belirli bir gün
  ve seçim için her cari → {gider / elenir + TEK neden adı (2.5 sırası) + etiket; {{3}} en eski gecikmiş açık kalemin vadesi; {{4}} tutar; {{5}} bakiye}. Tutar zaten
  modellenmiş Gecikmiş Borç'tur (kâhinin tek borç sırası) — yeniden yazılmaz, kullanılır.
  S-C5C-4 (yeni taksit kartının açma sınırı tek borç sırasından; programda AYRI küçük turda yapılacak) bu bakımda MODELLENİR (aynı kâhin; toplu bakım): taslak 3.6'nın
  örneği (F 900, kart K 600, karta bağlanmadan cari tahsilatı 600 → sonra F2 600 → 600'lük yeni kart AÇILIR).
- **WHATSAPP KÂHİNİ (güncelleme 21) — "KAÇ KEZ / NE ZAMAN / HANGİ İÇERİK":** taslak §4 (dönem = gün; 4.1, 4.2, 4.3), §5 (kuyruktayken durum değişirse: 5.1, 5.2, 5.3 =
  S-C5C-5 A, 5.4, 5.5 = S-C5C-6 A, 5.6), §6 (elle seçim izi ve Yine de Gönder: 6.1 = S-C5C-7 A — "Yine de Ekle", 6.2, 6.3 = S-C5C-8 A, 6.4), §7 (sürüm geçişi: 7.1, 7.2,
  7.3), §8 (devir, Devri Geri Al, geri yükleme: 8.1 = S-C5C-9 A, 8.2, 8.3, 8.4), §9 (iki şirket). Kime / hangi tutar sorusunu WhatsApp kâhini HESAPLAMAZ: her gün ve her
  cari için "kime / tutar / neden" GİRDİ olarak (senaryonun parçası, elle yazılmış) verilir; WhatsApp kâhini bu girdiyle kaç kez / hangi anda / hangi içerikle sorusunu
  modeller. İki kâhini program içi değişmez bağlar: hatırlatmadaki tutar = cari kartındaki Gecikmiş Borç (sürücü / ana oturum karşılaştırır — kâhinlerin işi değil).

## 3. Senaryo sınıfları (taslak §0 "Nasıl bozulur?" N1–N30; her satır EN AZ bir elle senaryo, beklenenler ELLE)

- CARİ KÂHİNİ: N1, N2, N3, N4, N5, N6, N7, N8 (vadesiz kalem ertesi gün — S-C5C-1 A; vade günü gecikmiş DEĞİL — 1.2), N9, N10, N11, N26 (elle metindeki "N kalem
  (tutar)"), N27, N28 (önizlemedeki "Elenenler ve Nedenleri" sayıları + bilgi satırı), N29 (taksit kartı ↔ cari kartı ↔ yeni kart sınırı aynı borç); ek: "Diğer" türü
  cari (S-C5C-2 A), tedarikçiye verilmiş avansın gecikmişi (S-C5C-3 A — hiçbir yoldan), söz günü / söz ertesi günü (K9-1), şüpheli kaydın kapanması (2.2 okuması), bize
  alacaklı cari, iki şirket (9.2), S-C5C-4 örneği ve onun sınır durumları.
- WHATSAPP KÂHİNİ: N12, N13 (S-C5C-5 A), N14, N15 (S-C5C-6 A + 5.6), N16 (S-C5C-8 A — Ödeme Hatırlatma'da güncel tutar; Ekstre'de "aynı ileti" kuralı AYNEN),
  N17 (S-C5C-7 A — "Yine de Ekle" izi Devam Et ve yeniden denemede taşınır), N18, N19, N20, N21 (S-C5C-9 A — "Durduruldu (Devir)", gönderilmeyenler almamış), N22,
  N24, N25, N30 (gece yarısını geçen iş; 5.2 ve 4.1); ek: aynı gün ikinci hatırlatma (4.1 "Daha Önce Gönderildi" sorusu, ertesi gün serbest), elenen kişinin o gün
  "almamış" sayılması ve koşul kalkınca aynı gün gitmesi (4.3), Sonucu Belirsiz + Yine de Gönder + şüpheli kaydı açılması (6.2), Devri Geri Al sonrası aynı gün (8.2).
- Rastgele üreticiye (her kâhin kendi üreticisinde, tohumlu) bu sınıflardan uygun olanlar.

## 4. KAPSAM DIŞI (bu bakımlarda YOK)
- Ödeme Hatırlatma önizlemesinin HIZI (ana oturum ölçer — kâhinin işi değil).
- Ekstre (PDF'li) gönderiminin kuralları — DEĞİŞMEZ (yalnız 6.3'teki "Ekstre'de aynı ileti kuralı aynen" denetimi).
- Devri uygulayan paketin kendisi (yarıda kesilme vb.); WhatsApp kâhini yalnız devrin hatırlatma işlerine etkisini modeller (§8).

## 5. Kullanıcı kuralları (AYNEN)
- (14.11) "bana sorun varsa önerilerini uygula" — soru öneriyle yazılır; "kime kaç kez" / para kuralı soruları yanıt beklenerek sorulur (ders 43, 45).
- (06.11) "bana soru sorduğunda eğer çok uç durumsa konu; seçeneklere uç durum böyle kalmasında sorun yok maddesi de ekle".
- (20.11) "yapılan işlerde döngüye girmeyelim detaylara boğulup, programı yada kullanıcıyı etkileyemem hususları 2.5.1 sürümüne bırakalım" — kâhinin iç düzeni / belge
  türü husus kovalanmaz, raporun "SONRAYA" başlığına yazılır.
- (12.11) yaygın muhasebe programları referans alınabilir; bir programın davranışı ancak belgesi okunmuşsa dayanak yazılır.
