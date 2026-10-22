# 2.4.4 bağımsız kâhin — kural kaynağı (madde 31a; ana oturum hazırladı, 22.10.2026)

Bu dosya kodu GÖRMEYEN kâhin ajanları içindir. Etiketler (test/bagimsiz/SENARYO-DILI.md sürüm 4'teki [PLAN]/[KABUL] düzeniyle aynı mantık):
- [KULLANICI] — ürün sahibinin kararı; metni CLAUDE.md "Açık iş" bölümünde (birincil kaynak). Programla fark = BULGU.
- [GİB] — mevzuat/GİB kılavuzu (birincil). Programla fark = BULGU.
- [AJAN] — kuralı KODU YAZAN ajan raporladı (aşağıdaki "Ajan kural metinleri"). Ayrıntı (ret kodu, sayaç alanı, sınır günü) birincil kaynakta yoksa
  fark = İNCELE (BULGU değil); birincil kaynakla ÇELİŞİYORSA birincil kaynak geçer ve bunu raporda ayrıca yaz. Ajanın verdiği ÖRNEK ÇIKTILARI
  (ör. "B1250 stopaj250") beklenen sayı sayma: girdileri kullan, çıktıyı modelin kendisi hesaplar; örnekle farklı çıkarsa raporda yaz.

## A. e-Belge kâhini (test/bagimsiz/ebelge — kahin-ebelge ajanı)
A1 K33 Seçilenleri Gönder kronolojisi (madde 17). [KULLANICI] CLAUDE.md Açık iş "MÜŞTERİ İSTEKLERİ → 2.4.4 (1) Seçilenleri Gönder" + 2.4.3 kronoloji
   kararları; mevcut K6/K8/K9/K10 (test/bagimsiz/ebelge/KARARLAR.md). [AJAN] ayrıntı: aşağıda "17".
A2 K22 iptal süresi (madde 23). [GİB] docs/kanit/2026-10-22/244-iptal/kaynak/e-Arsiv_Uygulamalari_Iptal_Ihtar_Itiraz_Bildirim_Kilavuzu_V.1.1.pdf §3
   ("8 günlük sürenin tespiti e-belgenin alıcıya iletilme tarihinden itibaren başlar"); [KULLANICI] CLAUDE.md Açık iş KARARLAR (5) İPTAL SÜRESİ: e-Arşiv VE
   e-SMM 8 gün, İLETİM (gönderim) tarihinden; başlangıç günü sayılmaz, 8. gün dahil (TBK 92); "Yalnız Programda İptal" gönderilmiş belgede süreyi atlamaz.
   Mevcut K22 ("≤7") bu kaynakla düzeltilir. [AJAN] (madde 23 raporu): iletim günü = İşlem Geçmişi'ndeki SON gönderim girişimi (kabul / taslak yüklendi /
   sonucu belirsiz; durum sorgusu sayılmaz), programın yerel günü; kayıt yoksa kesim günü; süre dolunca "Yalnız Programda İptal" de reddedilir; e-SMM dahil.
A3 Belirsiz gönderimde yerel iptal (madde 23 ek). [KULLANICI] CLAUDE.md Açık iş "SORU (22.10.2026, madde 23 iptal süresi)" + KARAR "önerin uygun": 8 gün
   geçtiyse yalnız-programda iptalden önce EDM durum sorgusu zorunlu; EDM "bulunamadı" (iletilmemiş) → iptal serbest; "var" → süre dolmuş, iptal reddedilir.
   [AJAN]: EDM'de var → 409 cancel-late/einvoice-found; EDM'ye ulaşılamaz → 502; e-SMM'de her hata "bilinmiyor" → 409.
A4 e-SMM türü (madde 22, 24). [KULLANICI] CLAUDE.md Açık iş "e-SMM" maddeleri (numarayı program verir; iptal 8 gün; e-SMM 2.4.4'te açılır). [AJAN] "22".
A5 UX15 ön hesap ⇔ kayıt (madde 12). [KULLANICI] 2.4.3 kararları (Kalıcı ürün kararları "2.4.3 kararları"; numaralı belgede Düzenle tür değiştiremez) +
   VUK sıra-tarih uyumu (KARARLAR.md K6). [AJAN] "12 UX15" R1–R5 ve değişmez "ön hesap çakışma diyor ⇔ kayıt reddediyor".
A6 Alıcı zorunlu alanları (madde 11). [GİB] e-Fatura/e-Arşiv alıcı bilgileri; [AJAN] "11".

## B. Cari / evrak / tutar kâhini (test/bagimsiz/defter ve yeni modeller — kahin-cari ajanı)
B1 5a/5b/5c Tablodan Aktar (madde 5a–5c). [KULLANICI] CLAUDE.md Açık iş "SORULAR (22.10.2026, madde 5 yapılırken)" (a)(b)(c) + "SORULAR (22.10.2026, 5a/5b
   yapılırken)" (1)(2)(3) — ikisi de "uygun"; K11 bir olay = bir para hareketi (docs/BANKA-MODULU-PLAN.md Özet). [AJAN] "5a/5b/5c".
B2 UX18 çek/senetle fatura kapama (madde 15). [KULLANICI] CLAUDE.md Açık iş KARARLAR (2) UX18 + "SORU (22.10.2026, madde 15 UX18)" KARAR "önerini uygula";
   yevmiye: docs/BANKA-MODULU-PLAN.md §3.11a (çek/senet hesapları). [AJAN] "15".
B3 Netten Brüte (madde 26). [GİB] GVK 94/1 (stopaj yükümlüleri), 94/2-b (%20 serbest meslek); KDV tevkifat (KDV Genel Uygulama Tebliği; 602 = 9/10).
   [AJAN] "26" (formüller ve uzlaşım "birden çok B uyarsa en küçüğü").
B4 e-SMM UBL tutarları/stopaj (madde 20–21). [GİB] e-SMM UBL-TR kılavuzu (ebelge.gib.gov.tr; indirebilirsen sha256 ile kanıt klasörüne); EDM belgeleri:
   /root/.claude/uploads/456ebc12-8183-520e-989e-af270fef8a58/694793fb-Ek_bilgi.txt (dip toplam anlamları), 7e40f397-esmm-ubl-ornek-veri.xml (EDM örneği —
   SAYILARI TUTARSIZ: net > brüt, KDV %18; kâhin kaynağı DEĞİL, yalnız yapı), metinler <not defteri>/esmm-dok-v4/. TesterCurrent.cs OKUNMAZ (hesap bilgisi içerir).
   [AJAN] (madde 20–21 raporu): kalem kalem yuvarlanan stopaj çok kalemli makbuzlarda belge toplamından 1–2 kuruş ayrışabilir; program XML'de belge toplamını
   kalemlere kuruşu kuruşuna dağıtıyor (Σ kalem = belge). Kural kaynağını GİB'den kur; hangisinin doğru olduğu GİB'de yazmıyorsa ÇATAL + İNCELE.

## Ajan kural metinleri ([AJAN]; iş listesi teslim notlarından AYNEN çıkarıldı)
### 26 (Netten Brüte, fed393c): sunucu kaydın kendi yolunda çöze …
KÂHİN KURALI (madde 31, kodu görmeyen ajan): GVK 94/1 stopaj yükümlüleri (kamu, sermaye şirketi, kooperatif, dernek/vakıf, basit usul dışı ticaret ve serbest meslek erbabı) — ticari faaliyeti olmayan gerçek kişiye kesilmez; 94/2-b %20; elle oran geçer; stopaj = yuvarla(B×oran), Net = B − stopaj, KDV = yuvarla(B×kdv), tevkifat = yuvarla(KDV×pay/payda) (602 = 9/10), ödenecek = Net + KDV − tevkifat; hedef B − stopaj(B) = N, birden çok B uyarsa en küçüğü (uzlaşım). Örnek: kişi/boş/KDV20/N1000 → B1000 öd.1200; tüzel/boş/N1000 → B1250 stopaj250; tüzel KDV dahil N1000 → fiyat 1500; kişi KDV dahil N1000,03 → 1200,04; tüzel %17 KDV10 N1000 → B1204,82 öd.1120,48; tüzel 602 N1000 → öd.1025.

### 17 (Seçilenleri Gönder, e83adde/f7edff3/3a2f46a): send-pendi …
K33 kâhine kodu görmeyen ajan yazacak — KURAL: aynı seri + yılda seçilenin tarihinden ESKİ (aynı gün değil), seçilmemiş, numarasız, kalıcı engelsiz bekleyen varsa ilk istek 409 (count, older ≤50, olderIds), numara verilmez, EDM'ye gidilmez; aynı gün / başka seri / numaralı / belirsiz / kalıcı engelli eski bekletmez; ön denetimden sonra kaydedilen eski belge kalan seçilileri "outside" ile bekletir.

### 5a/5b/5c (is/kayit f6d3828 / 7d51d60 / 0f19206): KÂHİN KURAL …
KÂHİN KURALLARI (madde 31, kodu görmeyen ajan) — 5a: carinin taksit dışı tahsilatları tarih sırasıyla BÜTÜN olarak karta taşınır, en çok kartın kalanı kadar; sığmayan ilk tahsilatta durulur, o tahsilat bölünmez; fazlası taksit dışı kalır; cari bakiyesi, Kasa/Banka değişmez; geri al tahsilatları cariye iade eder. 5b: carinin borcu tablodaki kalanı karşılıyorsa kart o borcu taksitlendirir ("mevcut borcu taksitlendir"), yeni borç yazılmaz; borç tablodaki kalandan azsa kayıt aktarılmaz; faturalı caride ya da seçenek kapalıyken yeni borç yazılır ve uyarı çıkar. 5c: bir dosya no'nun tahsilatı rapordaki sekme sayısından bağımsız bir kez sayılır.

### 11 (UX9/UX10, a61d561): düzeltme CARİ KARTINA yazılır (bildi …
KÂHİN KURALI: il her e-Belgede zorunlu; vergi dairesi e-Fatura'da VKN'li alıcıda zorunlu; nihai tüketicide 30.000 TL üstü gerçek TCKN + ad + adres.

### 22 (e-SMM gönderim kapıları, is/esmm2 735da8f): sendKind tek …
KÂHİN KURALI: e-SMM yalnız bayrak açık + firma e-SMM kullanıcısıyken ESMM profiliyle; aksi kâğıt (SMM serisi), gönderilmez; seri testte TES, canlıda ESM, TEA/EAR ve TEF/EFT'den bağımsız; seri+yıl içinde numara sırası = tarih sırası; bütün işlemler ESmmEDM.svc; numara yalnız giriş başarılıysa, kesin ulaşmadıysa geri bırakılır; belirsizde önce durum, ikinci gönderim yok; EDM ID/UUID farkı başarı değil; iptal önce EDM sonra program, iletimden 8 gün. Örnek: bugün/−2/−1 üç makbuz + −1 e-Arşiv → TES n, n+1, n+2 tarih sırasıyla, TEA ayrı.

### 15 (UX18, is/ux18 cf6de13 + 55584e6): bağ yalnız cheque_even …
KÂHİN KURALI: alınan evrak T, F'ye bağlı → F.açık = max(0, açık − T), fazlası en eski açık faturaya; bağ kurulamaz (taksitli 409, başka cari 404, ters yön/iade/taslak/iptal 409, taksite sayılan ya da carisiz evrak 400) → hiçbir satır yazılmaz; F iptal → evrak portföyde, bağ düşer, evrak en eski açık faturayı kapatır; karşılıksız → F'ye saydığı + fazlası geri açılır (taksitli değişmez); yevmiye çek B 101.01/A 120, senet B 121.01/ A 120, verilen çek B 320/A 103; değişmez Σ açık = cari bakiye. Örnek: Y 1.000 + X 800, evrak 800 X'e → X 0, Y 1.000; W 500 + X 500, evrak 1.000 X'e → 0/0, karşılıksız → 500/500, bakiye 1.000.

### 12 UX15 (is/ux15 403a350 + 3a58fda): kayıttaki kurallar tek  …
KÂHİN KURALI: R1 aynı seri+yılda son numaralının (iptal dahil) tarihi yeni tarihten büyükse red, aynı gün serbest (Kes Sonra Gönder de); R2 Düzenle'de numaralı belge önceki ile sonraki arasında, yılı değişmez; numarasız bekleyen serinin son numaralısından eski tarihe alınamaz; R3 elle numara aynı cari+tür+numara (tr-TR büyük harf) kayıtlıysa red (Düzenle'de kendisi hariç); R4 tarih kilit gününe eşit/önceyse red; R5 seride yeni tarihten eski + serinin son numaralısından eski olmayan, kalıcı engelsiz numarasız bekleyen varsa numara verilmez; değişmez: "ön hesap çakışma diyor" ⇔ "kayıt reddediyor", iletiler aynı.

