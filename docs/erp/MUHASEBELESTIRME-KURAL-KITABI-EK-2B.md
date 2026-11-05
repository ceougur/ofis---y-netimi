# Muhasebeleştirme Kural Kitabı — EK-2B: Bağımsız Yineleme (kâhin 23, 24, 28, 32, 33, 35; karar çelişkileri K-2, K-3)

> **Bu ek programın kodu görülmeden yazıldı.** Kaynak: aşağıdaki "Bağımsızlık beyanı"ndaki dosyalar, mevzuat ve program belgeleri (arama özetleri).

Durum: TASLAK. Kodu görmeyen mali müşavir ajanı, EK-2B turu (temiz bağlam), 05.11.2026 ~21:20 UTC. Baş mimar inceler; SORU sınıfındakiler
kullanıcıya (ders 43, 45). Bu tur EK-1'i ve önceki kararları DEĞİŞTİRMEZ; yalnız açık kalan noktaları sınıflar ve kâhinin geçici seçimini karşılaştırır.

Sınıflar: **TÜRETİLDİ** (kitap / EK-1 / karar metninden tek okuma) · **SINIFLAMA** (para değil; hesap / ad) · **SORU** (iki okuma; para, kapama sırası ya da
"kime hatırlatma" değişir → kullanıcı karar verir). Mevzuat dayanakları birincil metinden okunamadı (§7) → "GÖRÜŞ / DOĞRULANMADI" işaretli.

---

## Bağımsızlık beyanı

**Okunan depo dosyaları (yalnız bunlar):**
- `CLAUDE.md` (oturumla yüklendi, tamamı).
- `docs/erp/MALI-MUSAVIR-AJANI.md`, `docs/erp/MUHASEBELESTIRME-KURAL-KITABI.md`, `docs/erp/MUHASEBELESTIRME-KURAL-KITABI-EK-1.md`, `docs/erp/MUHASEBE-CEKIRDEGI-PLANI.md`,
  `docs/devir/DEVIR-PLANI.md`, `docs/2.3.0-SUPHELI-KABUL.md` (tamamı).
- `docs/BANKA-MODULU-PLAN.md`: satır 397–414 (§3.8), 541–606 (§3.11a, §3.11b) + aşağıdaki aramaların döndürdüğü satırlar.
- `docs/GECMIS-KARARLAR.md`: satır 300–339, 360–394, 725–769, 778–799, 815–839, 985–1004 + aramaların döndürdüğü satırlar.
- `docs/2.5.0-IS-LISTESI.md`: satır 1–80 (başlık, A), 129–175 (C, D).
- `docs/kilavuz/DestekOfis-Kullanim-Kilavuzu.html`: etiketleri ayıklanmış metni kendi not defteri klasörüme yazıldı
  (`/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/mali-musavir-ek2b/kilavuz.txt`); okunan: 138–152 (Kasa), 285–310 (Taksitler), 340–352 (Fatura), 203, arama satırları.
- Soru dosyası `/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/mali-musavir-ek2b/sorular.md`.

**Yapılan aramalar (hepsi dosya adı verilerek, yalnız listedeki dosyalarda; depo / klasör geneli arama YOK):**
1. BANKA-MODULU-PLAN: `^#{1,4} |3\.11|vazgeçilen|Kartı Kapat|kapatılan kart` · `açılış(ı| tarihi)…(ilk hareket|önce|sonra|düzelt)|opening_date…` · `689` · `ilk hareketten önce|Kasa açılış`.
2. GECMIS-KARARLAR: `Kartı Kapat|vazgeç|kapatılan kart…` · `Yeniden Aç|kapalı kart|kalan alacak|KG-23|…` · `kalanın sil|kart kapatma|…` · `taksit.{0,80}kapat|kapat.{0,80}taksit|…` ·
   `hayalet|Mahsup Et` · `ilk hareketten önce|Kasa açılış|…` · `K6` (kasa / açılış süzgeci) · `küçül` · `689` · `etkileri? geri al`.
3. 2.5.0-IS-LISTESI: `^## ` (başlıklar) ve `KG-23|Kartı Kapat|vazgeç|K-3|K-2|S1|S2|M1d|kapatılan`.
4. Kılavuz (html ve ayıklanmış metin): `kartı kapat` · `açılış` · `Kasa Açılış|ilk hareket|…` · `küçül|kırp` · `İptal Et|faturayı sil|Seçilenleri Sil` · `Açılışı Düzelt` · `689`.
5. Kural kitabı, EK-1, çekirdek planı, DEVIR-PLANI, CLAUDE.md: `etkileri? geri al`. 2.3.0-SUPHELI-KABUL: `689`.

**AÇIKLAMA (bölüm sınırı aşımı — ana oturum değerlendirir):** arama 3'ün ikincisi `docs/2.5.0-IS-LISTESI.md` dosyasının TAMAMINDA koştu ve "## E." bölümünden şu satırları ekrana
getirdi: 199, 244, 246, 274, 277, 283, 284, 286, 326, 333, 334, 338, 359, 361, 362, 366, 367, 368, 372, 383, 387, 388, 393, 410. Görülen içerik: ajan durum / zaman notları, DÜŞÜK bulgu
özetleri; 326 "DENENMEYEN (sürücü): … Kartı Kapat …"; 361–367 kâhin bakımının ek maddeleri (R1 2.3.0 K3, R2 M-01 + G-7, R3 silinen fatura) ve açık soru numaraları (23–35, 36–40); 410 soru düzeni.
Program davranışı ya da kod anlatan satır yoktu. Bu satırlar bu ekin hiçbir sonucunda kullanılmadı; sonuçlar yalnız yukarıdaki izinli kaynaklardan ve mevzuat aramalarından türetildi. Fark
fark edildikten sonra iş listesi yalnız 1–80 ve 129–175 aralığında okundu.
- Git: yalnız `git merge --ff-only 92f53e8f` (çıktının son üç satırı `test/` altındaki üç yeni dosyanın ADINI gösterdi — açılmadı) ve `git log -1 --format='%h %s'` (yalnız HEAD başlığı);
  bitişte bu dosyanın `git add` + `git commit`'i. Fark / geçmiş okunmadı.
- YASAK klasörlerin (`server/`, `client/`, `test/`, `tools/`, `bulut/`, `docs/kanit/`), öbür `docs/*.md` dosyalarının, not defterindeki başka klasörlerin (özellikle `mali-musavir-ek2/`) hiçbiri
  açılmadı, listelenmedi, aranmadı. Program çalıştırılmadı.
- Ağ: 7 arama (§8). `docs.logo.com.tr` ve `www.mevzuat.gov.tr` sayfa açma denemesi ad çözülemedi (ENOTFOUND; oturumun ağ ayarlarında izinli değil) → yalnız arama özetleri.

---

## 0. Özet

| # | Konu | Sınıf | Kural (kısa) | Kâhinin seçimi |
|---|---|---|---|---|
| 23 | Bağsız ödeme sonradan doğan borca kayar mı | **SORU** (2B-S1) | Öneri A: ödeme, TARİHİNDE açık olan borçlara S2 sırasıyla; sonradan doğan borca kaymaz | ANINDA → A seçilirse KABUL |
| 24 | Bağ, hedefi önceden bağsız kapanmışsa | TÜRETİLDİ | Bağ hedefini her durumda kapatır; bağsız ödemenin o kısmı serbest kalır, kendi tarihinde yeniden dağılır | KABUL |
| 28 | K sonrası bağ ↔ K'de bağsız kapanmış ≤K kalem | **SORU** (2B-S2) | Öneri A: kilitli dönemdeki bağsız kapanış kilit sonrası bağla geri alınmaz; bağ bağsız gibi dağılır | DEĞİŞİR (A'da); iddia düzeltmesi |
| 32 | Kart alttaki borçtan büyük | TÜRETİLDİ + **SORU** (2B-S3) | Kart kendisi küçülür (kılavuz); hangi taksitten → soru (öneri: vadesi en önce gelen açık taksit) | DEĞİŞİR (kart_fark havuzu yok) |
| 33 | Kasa açılış tarihini ilk hareketten sonraya düzeltme | TÜRETİLDİ | Reddedilir (bankadaki 409 `bank-opening-after-first` kuralının Kasa karşılığı) | DEĞİŞİR |
| 35 | Silinen / iptal edilen faturaya bağlı taksit kartı | TÜRETİLDİ | Faturanın kendi kartı faturayla birlikte kalkar; silmede tahsilatlı kart engel; iptalde tahsilat avans | DEĞİŞİR |
| K-2 | Aynı kişide satış borcu ↔ alış borcumuz (gecikmiş) | **ÇELİŞKİ VAR → SORU** (2B-S4) | Öneri A: gecikmişte düşülür (net); fatura durumu yalnız Mahsup Et ile | — |
| K-3 | Kartı Kapat: kalan borçta kalır mı | **ÇELİŞKİ VAR → SORU** (2B-S5) | Öneri A: borçta kalır (KG-23 A, S1); bugünkü plan metinleri 689'a gider yazıyor | — |

---

## 1. Kaynak A

### Madde 23 — Tek Yükümlülük Kuyruğunda (TYK) bağsız ödemenin zamanı: ANINDA ↔ HAVUZ

- **SINIF:** SORU (2B-S1). İki okuma metinde var: EK-1 §1 adım 4 "bağsız alacak kalemleri havuzlanır … açık borç kümesi sıralı listenin SONUNDAKİ kalemlerdir" (HAVUZ) ↔
  kullanıcının S2 kararı "bağlamadan yapılan ödeme önce hangi borcu kapatsın → vadesi en önce gelen (TBK md. 102)" + M2 A değişmezi (EK-1 §1 6(iv), §4 madde 4; BAŞ MİMAR KARARI,
  kullanıcıya gösterildi). Para ve "kime hatırlatma" değişir (s41 C2: 40.000 ↔ 0).
- **KURAL (öneri A, kâhin biçimi):** olaylar TARİH sırasıyla işlenir (giriş anına göre değil; geriye tarihli kayıt kendi tarihinde girmiş sayılır). Bağsız alacak kalemi tarihinde
  (o gün dahil: aynı günün borç kalemleri ödemeden önce sayılır) açık olan borç kalemlerine S2-A sırasıyla (vade → belge tarihi → giriş sırası) uygulanır; artan kısım avanstır ve sonra doğan
  her borç kalemine doğduğu gün aynı sırayla uygulanır. Kapanmış borç kalemi sonradan doğan bir borç yüzünden yeniden açılmaz. Girdi s41 C2 → beklenen: gecikmiş(11.05) = 40.000 (F7), F6 ödenmiş.
- **KAYNAK:** S2 kararı (iş listesi D, 05.11 ~18:55); EK-1 §1 adım 4 ve 6(iv), M2; TBK md. 102 (ödeme "yapılmış sayılır" — ödeme anındaki borçlar arasında; muaccel borç → ilk takibe uğrayan →
  vadesi ilk gelen → aynı vadede oranlı; hiçbiri muaccel değilse güvencesi en az olan — ikincil kaynak, GÖRÜŞ); 2.0.17 m5 "hayalet kısmi ödeme" şikâyeti (GECMIS-KARARLAR 368–389:
  kapanmış belgenin sonradan durum değiştirmesi müşteriyi yanıltıyor).
- **"model" ile karşılaştırma:** kâhinin ANINDA seçimi = öneri A → A seçilirse KABUL. İki netleştirme: (1) "girildiği anda" değil "ödemenin TARİHİNDE" (tarih + G-4 sınıf + giriş sırası;
  ders 31 — sonuç giriş saatine bağlı olmaz); (2) aynı gün: önce o günün borç kalemleri, sonra alacak kalemleri (sınıf sırası; aynı gün içinde yazım sırası gecikmişi değiştirmez).
  Ek (M2 için TEKNİK): devir açık kalemi TYK sıralamasında asıl vade + asıl belge tarihi + devir öncesi göreli giriş sırasıyla girer (M12'deki satır tarihi K+1 sıralama anahtarı OLMAZ);
  yoksa eşit vadeli kalemlerde devirli ↔ devirsiz ayrışır.
- **Not:** EK-1'in "M2'yi her durumda yalnız ANINDA sağlar" iddiası madde 28'deki durum dışında doğrudur (madde 24'ün geri alması M2'yi orada da bozar).
- **Kullanıcıya:** §4 2B-S1.

### Madde 24 — "Bağlar önce": hedefi daha önce bağsız kapanmış bağ

- **SINIF:** TÜRETİLDİ.
- **KURAL:** bağ (fatura formundaki peşin, Kapatılacak Fatura, Mahsup Et, çek / senet bağı, kart tahsilatı, iade faturasının asıl fatura bağı) hedefini her durumda kapatır: en çok
  "hedef tutarı − öteki bağlar" kadar; hedefin o kısmını önceden kapatmış bağsız ödeme(ler) o kadar serbest kalır ve kendi tarihinde (madde 23 kuralıyla) öteki açık borçlara yeniden dağılır;
  bağın fazlası bağsız alacak olur. Girdi s39 (Mahsup Et) → beklenen: hedef fatura bağla kapalı, serbest kalan bağsız ödeme S2 sırasıyla başka kalemde.
- **KAYNAK:** EK-1 §1 adım 3 (bağlar adım 4'teki bağsız havuzdan ÖNCE; "fazlası bağsız alacak olur"); DEVIR-PLANI §4.2 (eski metin, kapama düzeninin tarifi: "önce bağlı ödeme, kalan FIFO");
  DEVIR-PLANI G7 "kapama okumada yeniden hesaplanır"; kılavuz Fatura → "Sonradan tahsilat / ödeme: … + Tahsilat Ekle … kayıt bu faturayı kapatır" (kullanıcıya verilmiş söz);
  2.0.17 m5 (b) "Kapatılacak Fatura … seçilirse bağlı", (c) "Bu Faturayı Kapatanlar". Hukuk: TBK md. 101 borçlunun beyanı TBK md. 102'den önce gelir (ikincil, GÖRÜŞ). İkinci okuma
  ("ilk gelen kazanır": bağ, hedefi kapalıysa kendisi bağsız olur) hiçbir karar metninde yok ve kılavuzdaki "kayıt bu faturayı kapatır" sözüyle çelişir.
- **"model" ile karşılaştırma:** KABUL. Madde 23 B (HAVUZ) seçilirse bu kural kendiliğinden çıkar; A seçilirse geri alma bu kuralın zorunlu uygulamasıdır. Sınırı madde 28'de (kilitli dönem).

### Madde 28 — M2 değişmezinin sınırı: K sonrası bağ, K'de bağsız kapanmış ≤K kaleme yönelirse

- **SINIF:** SORU (2B-S2). Üç BAŞ MİMAR / karar metni birlikte tutmuyor: DEVIR-PLANI G2 ("kapanmış ≤K fatura K sonrası bir satırdan bağlıysa bağ arşiv başvurusuna çevrilir" → devirli
  dosyada bağ bağsız kalır), madde 24 (devirsiz dosyada bağ geri alır) ve M2 A ("gecikmiş devirle değişmez"). Etki: kime hatırlatma (nadir).
- **İddia düzeltmesi:** "alacak yönlü bağda borç tarafı iki dosyada eşit kalır" yalnız TOPLAM için doğru; açık kalemlerin VADESİ alacak yönlü bağda da ayrışabilir. Örnek (2B-S2'deki):
  01.11 F1 10.000 (vade 30.11) · 20.11 bağsız ödeme P 10.000 (F1'i kapatır) · 05.12 F2 10.000 (vade 31.03) · K = 31.12 · 05.01 F3 10.000 (vadesiz) · 10.01 T 10.000 "Kapatılacak Fatura: F1".
  Devirsiz (madde 24): T → F1; P serbest, 20.11'de açık borç yok → avans → 05.12'de F2'yi kapatır; F3 açık → gecikmiş(11.01) = 10.000. Devirli (G2): arşivde F2 açık → devir açık kalemi;
  T arşiv başvurusu → bağsız → 10.01'de açık F2 (vade 31.03), F3 (vade 05.01) → F3 kapanır → gecikmiş(11.01) = 0.
- **KURAL (öneri A, kâhin biçimi):** dönem kilidi L (devirde L = K). Tarihi > L olan bir bağın hedefi, yalnız ≤ L tarihli kayıtlarla (madde 23 kuralıyla) bağsız ödemeler tarafından
  kapatılmışsa, bağ o kapanışı geri ALMAZ: hedefin L itibarıyla açık kalan kısmını kapatır, fazlası bağsız alacak olur (G2'nin "arşiv başvurusu" kuralının tek dosyadaki karşılığı). Kilit
  kaldırılınca kural o dönem için kalkar (açık dönemde madde 24). Program kayıtta söyler: "Bu fatura kilitli dönemde kapanmış; tahsilat carinin vadesi en önce gelen borcuna sayılacak."
  Kâhin karşılaştırması: devirli dosya ↔ AYNI kilitle (L = K) devirsiz dosya → yukarıdaki örnekte ikisinde gecikmiş(11.01) = 0.
- **KAYNAK:** DEVIR-PLANI G2, G7, §1 ("devirden sonra … dönem kilidi = kesim tarihi"), §0 ("devir yapmayan müşteri tek dosyada … dönem kilidiyle"); EK-1 M2 A; çekirdek §4 Ç3 (kilitli
  dönemin durumu sonradan değişmez — ilke); kitap §8.
- **"model" ile karşılaştırma:** A seçilirse DEĞİŞİR (kilit / K sınırında geri alma yok); B seçilirse model aynen, bu durum değişmez (iv)'ün yazılı istisnası olur.
- **Bağımlılık:** madde 23 (A ya da B) ve madde 24'e bağlı. 23 = B (HAVUZ) seçilirse M2 zaten tutmaz; bu soru yalnız 23 = A iken anlamlıdır.
- **Kullanıcıya:** §4 2B-S2.

### Madde 32 — Taksit kartı alttaki borçtan büyük kalırsa

- **SINIF:** iki parça. (a) **TÜRETİLDİ:** kart, alttaki borç azalınca KENDİSİ küçülür. (b) **SORU** (2B-S3): küçülme hangi taksitlerden düşer (gecikmiş ve hatırlatma değişir).
- **KURAL (a):** borçtan düşülen iade (fatura iadesi ya da Stok → Müşteri İadesi), kartın tükettiği faturanın iptali / silinmesi (madde 35) ve düzenlemede küçülme, o borcu taksitlendiren
  kartı (faturanın kendi kartı ya da Carinin Mevcut Borcu kartı) aynı tutarda küçültür; küçülme kartın açık kalanını aşarsa fazlası carinin bağsız alacağı (avans) olur. Para geri verilen
  iadede (iade + T-09) kart DEĞİŞMEZ. Kart hiçbir zaman alttaki borcun üstünde kalmaz → "kart_fark" alacak kalemi YOK.
- **KAYNAK:** kılavuz Fatura → İade ("Borçtan düşülen iade, faturayı taksitlendiren kartı (faturanın kendi kartı ya da Carinin Mevcut Borcu kartı) o kadar küçültür; iade iptal edilince kart
  geri büyür"), kılavuz Stok ("Taksitlendirilmiş satıştan iade borçtan düşülürse taksit kartı da o kadar küçülür; para geri verilirse kart değişmez"), kitap S-04, kılavuz Taksitler ("Kart açıldığı
  günkü borcu taksitlendirir; tutarı sonradan büyütülmez"), GECMIS-KARARLAR 2.0.24 (787–797: "kart faturaya göre"; G1 paralı iade kartı küçültmemeli; G3 avans iadesi Mevcut Borç kartını kırpar;
  G5 geri büyüyen kartta taksit vadesi bugün — BİLİNEN SINIR).
- **"model" ile karşılaştırma:** DEĞİŞİR. Modelin "kart_fark" kalemi bağsız havuza girdiği için iadeyi kartın değil, carinin vadesi en önce gelen BAŞKA borcuna (ör. eski bir faturaya)
  uygulayabilir; kılavuz kartın kendisinin küçüleceğini yazıyor. Örnek: eski fatura I 5.000 (vadesi geçmiş) + kart T1 3.000 (vade gelecek ay) + T2 3.000; kartın faturasından 3.000 iade →
  model: I'den düşer, gecikmiş 2.000; kılavuz: kart küçülür, I aynen, gecikmiş 5.000 (2B-S3'ün iki seçeneğinde de).
- **(b) seçenekleri:** §4 2B-S3. Öneri A: vadesi en önce gelen açık taksitten (kart tahsilatıyla aynı: kılavuz "en eski açık taksite sayılır, fazlası sonrakine geçer"; S2; TBK md. 102 benzetmesi —
  GÖRÜŞ).
- **Bağımlılık:** madde 35'in Mevcut Borç kartı dalı bu soruya bağlı.

### Madde 33 — Kasa açılışının tarihini ilk hareketten SONRAYA düzeltme

- **SINIF:** TÜRETİLDİ.
- **KURAL:** Kasa açılışının (ilk girişte ve düzeltmede) tarihi, Kasa'nın açılış dışı ilk hareketinin tarihinden SONRA olamaz; aynı gün olur (açılış günün başındaki bakiyedir, G-4 açılış sınıfı).
  Sonraya alan düzeltme reddedilir, hiçbir şey yazılmaz, neden yazılır (çıkmaz yok: önce açılışı daha erken tarihe alın ya da hareketin tarihini düzeltin). Kilitli dönemdeki açılış düzeltilmez.
  Girdi: ilk Kasa hareketi 10.03, açılış 01.03 → düzeltme 15.03 → beklenen: ret, Kasa ve defter (M-01) aynen; düzeltme 10.03 → kabul; 01.02 → kabul (s53).
- **KAYNAK:** kitap M-01 ("Bir kez, ilk hareketten önce"), G-4; DEVIR-PLANI §4.1 (kural "bir kez, ilk hareketten önce" korunur); BANKA-MODULU-PLAN §3.8 Açılış satırı ("Açılışı Düzelt = ters + yeni.
  Yeni tarih hesaba bağlı ilk hareketten sonra olamaz (409 `bank-opening-after-first`) … Kilitli açılış düzeltilmez"), §12 Nasıl Bozarım ("Açılış tarihini ilk hareketten sonraya taşı → 409"),
  §10.3 ("açılış bakiyesi … gün başındaki banka bakiyesi; D'den önceki hareketler bu bakiyenin içinde"); kılavuz Banka ("Tarih hesapların açılışından önce değilse program kaydetmez").
  Muhasebe gerekçesi: açılış ilk hareketten sonraya alınırsa aradaki hareketler hem açılışın içinde hem ayrıca sayılır ya da o günlerde Kasa eksi görünür (kitap §7.3 imkânsız ters bakiye).
- **"model" ile karşılaştırma:** DEĞİŞİR — model reddetmeli; s53'e "sonraya alma → ret" ve "aynı güne alma → kabul" senaryoları eklenir.
- **Not (kural metni yok, soru değil):** aynı değişmezin öbür yüzü — açılış tarihinden ÖNCE tarihli yeni Kasa hareketi. Bankada "Hesapsız (Açılıştan Önce)" yolu var, Kasa'da karşılığı
  yazılı değil → kâhinde gözlem senaryosu; ayrışma çıkarsa önce hata (ders 6), kural gerekiyorsa sorulur.

### Madde 35 — Silinen / iptal edilen faturaya bağlı taksit kartı

- **SINIF:** TÜRETİLDİ (Mevcut Borç kartı dalı 2B-S3'e bağlı).
- **KURAL:**
  1. Faturanın KENDİ kartı (fatura ödemesi "Taksit", H-01): fatura silinince ya da iptal edilince kart faturayla birlikte kalkar; taksitleri TYK'dan çıkar. Kalan kart ya da "kart_fark" olmaz.
  2. SİLME: kartta tahsilat varsa silme reddedilir (hiçbir şey değişmez).
  3. İPTAL: kartta tahsilat varsa tahsilat silinmez; bağı çözülür, carinin bağsız alacağı (avans) olur ve TYK'ya girer (S5 = A; EK-1 M10 "taksit kartı tahsilatı" sayılmıştır).
  4. Faturayı Carinin Mevcut Borcu kartı tüketmişse: kart, faturanın o anki kalanı kadar küçülür (madde 32 (a)); hangi taksitten → 2B-S3.
  5. Kartın taksitlerine önceden dağılmış bağsız ödemeler serbest kalır ve kendi tarihlerinde yeniden dağılır (G-7 açık dönemde yeniden türetme; madde 23).
  Girdi: taksitli fatura 9.000 (3 × 3.000), tahsilatsız → sil → beklenen: cari bakiyesi 9.000 azalır (fatura öncesine döner), kart yok, gecikmiş 0 (başka borç yoksa).
- **KAYNAK:** GECMIS-KARARLAR 2.0.17 m1 (satır 317–321: "kaydedilmiş belge silinirken tek işlemde iptaldeki gibi bütün etkiler geri alınır (stok, cari, Kasa, taksit, çek/senet …) … Engeller iptalle
  aynı (iadesi olan → önce iade; e-Belgesi gönderilmiş silinmez; kilitli dönem; tahsilatı alınmış taksit / işlem görmüş çek)"); kitap F-15 ve G-7; EK-1 M10 + S5 kararı; kılavuz Fatura
  ("taksitinden tahsilat alınmış faturada Düzenle kapalıdır … o zaman İptal Et ya da İade"; "Fatura iptal edilirse evrak portföyde kalır, yalnız faturaya bağı kalkar").
- **"model" ile karşılaştırma:** DEĞİŞİR — model kartı kaldırmıyor ("kart_fark" üretiyor); karar "taksit etkileri geri alınır" diyor.
- **Not:** 2.0.17 m1'deki "Engeller iptalle aynı (… tahsilatı alınmış taksit …)" İPTAL'i de engelliyor gibi okunabilir; daha yeni kılavuz metni ("o zaman İptal Et") ve S5 / M10 iptale izin verip
  tahsilatı avans sayıyor → kural 3 bunlardan. Mevcut Borç kartının tükettiği faturanın silinmesinde engel olup olmadığı metinde yok (DOĞRULANMADI) → kâhinde gözlem senaryosu.

---

## 2. Kaynak B (karar metinleri arası çelişki)

### K-2 — Aynı kişi hem müşteri hem tedarikçi: alış borcumuz gecikmişten düşülür mü

- **ÇELİŞKİ: VAR → SORU (2B-S4).**
  - EK-1 §1 adım 1 TYK'nın alacak kalemleri arasında "alış faturası (aynı caride)" sayar; adım 4'te bağsız havuza girer → satış borcunun gecikmişini düşürür. EK-1 değişmezi (i):
    0 ≤ gecikmiş ≤ max(0, CH bakiyesi).
  - 2.0.17 m5 (GECMIS-KARARLAR 375–378; CLAUDE.md Kalıcı ürün kararları → Fatura): "kapama YÖNE göre … satış faturası, taksit kartı borcu, borç kaydı ödeme SAYILMAZ (satış ↔ alış karşılıklı
    kapama yalnız açık 'Mahsup Et' işlemiyle … cari BAKİYESİ zaten netleşir)". B1 kararı (05.11 17:16) "gecikmiş borca vadesi geçmiş fatura KALANI da girer" — fatura kalanı 2.0.17'ye göre
    alışla düşmez.
  - İki okuma: gecikmiş NET (EK-1) ya da BRÜT, yalnız Mahsup Et ile düşer (2.0.17 + B1 harfî). Para ve kime hatırlatma değişir.
- **KURAL (öneri A, kâhin biçimi):** aynı carinin alış faturası (ve öteki ters yönlü kalemleri) TYK'da bağsız alacak kalemi olarak kendi belge tarihinde (madde 23 kuralıyla) satış borçlarına
  uygulanır; gecikmiş ≤ net borç; net alacaklı cariye hatırlatma gitmez. Faturaların Açık / Ödendi durumu ve "Bu Faturayı Kapatanlar" 2.0.17 kuralıyla kalır (yalnız Mahsup Et değiştirir).
  Girdi: satış S 01.03 10.000 (vade 31.03), alış P 10.03 6.000 (vade 30.04), t = 15.04 → beklenen gecikmiş 4.000; S listede "Açık 10.000".
- **Gerekçe:** hatırlatma tutarı müşterinin elindeki ekstre bakiyesini hiç aşmaz (değişmez (i)); yerli programlarda cari tek hesaptır ve FIFO kapama türüne bakmadan "ters bakiyeli işlemleri"
  kapatır (Logo J3 FIFO Close — arama özeti, GÖRÜŞ); SAP'ta müşteri–satıcı mahsubu tanımlıysa ihtar programı iki tarafın vadesi geçmiş kalemlerini ortak bakiyeyle değerlendirir (help.sap.com,
  arama özeti, GÖRÜŞ). B'nin dayanağı: takas beyanla doğar (TBK md. 143) ve iki borcun da muaccel olmasını ister (TBK md. 139); Microsoft Dynamics 365'te mahsup ayrı işlemle yapılır
  (arama özeti) — GÖRÜŞ. Ara çözüm (yalnız VADESİ GELMİŞ alış borcumuz düşer — TBK md. 139) değerlendirildi: değişmez (i)'yi bozduğu ve ikinci bir tarih kuralı getirdiği için önerilmedi.
- **Not:** 2.0.17'nin "satış tarafında simetrik" sözü Alacak Yaz için de aynı soruyu doğurur; A seçilirse Alacak Yaz da EK-1'deki gibi havuza girer, B seçilirse Alacak Yaz için ayrıca karar gerekir.
- **Bağımlılık:** madde 23 (alış faturasının uygulanma zamanı).

### K-3 — Kalanı olan taksit kartı kapatılınca kalan borçta kalır mı

- **ÇELİŞKİ: VAR → SORU (2B-S5).**
  - KALAN BORÇTA KALIR: kitap H-07 ("Kartı Kapat (kalan varken) — madde yok; alacak CH'de kalır"), KG-23 A (para işaretli DEĞİL, kullanıcıya sorulmadı), EK-1 M1(d), kullanıcının S1 kararı
    (05.11 ~18:55: "… kalan varken kapatılan taksit kartı … ertesi günden itibaren gecikmiş" → kalanın borç olarak durduğunu varsayıyor).
  - KALAN BORÇTAN DÜŞER: BANKA-MODULU-PLAN §3.11b (c) (ürün sahibi kararı 15.10.2026 bölümü: "Taksit tahsilatı (ve kapatılan kartın VAZGEÇİLEN KALANI)" alacak satırı gibi şüpheliden düşer);
    2.3.0-SUPHELI-KABUL K3 (carinin alacak satırları arasında "kapatılan kartın vazgeçilen kalanı"); BANKA-MODULU-PLAN §3.8 Taksit kartı satırı ("'Kapat' 689'a yazdığı için …");
    GECMIS-KARARLAR 2.0.26 gözden geçirmesi (994–995: "kilitli günde kapatılmış kart … kilitli 689 sessizce değişiyordu") ve 2.0.22 Bulgu 2-G (743: "kart kapatma — kalanın silinmesi").
    Bu metinler programın bugün kalanı 689 ile carinin borcundan düşürdüğünü anlatıyor (kodu görmedim; plan metninden).
  - Kılavuz ikisini ayırt etmiyor ("Tahsilatı bırakan müşteri için Kartı Kapat: kalan varken program kalan tutarı söyleyip onay ister; kapalı kart uyarı vermez, kayıt durur").
- **KURAL (öneri A, kâhin biçimi):** Kartı Kapat (kalan > 0) → defter maddesi YOK; kalan, kapatma tarihli tek borç kalemi (M1(d)), vade = kapatma günü (S1 = A) → ertesi gün gecikmiş; şüpheli
  caride yeni alacak satırı doğmaz. Geçiş: 2.5.0'dan önce kapatılmış kartların kaydı olduğu gibi kalır (o gün onayla düşülmüş kalan geri gelmez); kural yalnız yeni kapatmalara. Girdi: 12 × 1.000
  kart, 7 taksit ödenmiş, 15.06 Kartı Kapat → beklenen: CH 5.000 borçlu, gecikmiş(16.06) = 5.000, 689 = 0.
- **Gerekçe (A):** alacaktan vazgeçme ancak belgeyle gider olur — değersiz alacak kaza hükmü ya da kanaat verici vesika ister, tek taraflı "vazgeçtim" yetmez (VUK md. 322; ikincil kaynaklar,
  DOĞRULANMADI), aksi hâlde kanunen kabul edilmeyen gider; borcun anlaşmayla düşmesi ibra sözleşmesidir (TBK md. 132; ikincil); ödeme planını kapatmak bunları kendiliğinden yapmamalı.
  Silmek isteyen için ayrı ve görünür yollar zaten var: Alacak Yaz (KG-4 A, 770.90) ya da Şüpheli Alacağa Al → Değersiz Alacak Yaz (J-01, J-05). Yaygın programlarda ödeme planının
  kapatılmasının cari bakiyeyi değiştirdiğine dair belge bulunamadı → GÖRÜŞ.
- **GÖRÜŞ (öneri değil):** "Yeni Borç" kartında (faturasız hizmet / aidat, H-03 geliri kart açılışında yazar) kapatmanın nedeni hizmetin sona ermesiyse doğru kayıt gelir düzeltmesidir (satıştan
  indirim), zarar (689) değil. A'da bu, kullanıcının ayrı bir işlemi olur; B seçilirse hesap ayrıca kararlaştırılmalı (689 olağandışı zarar mı, 600.90'ın tersi mi).
- **Bağımlılık:** S1 (karar verildi) ve madde 23 (kalan kalemin TYK'daki yeri).

---

## 3. Bağımlılıklar

- 24 ← 23: 23 = B ise 24 kendiliğinden; 23 = A ise 24 zorunlu ek kural.
- 28 ← 23, 24: yalnız 23 = A iken anlamlı; 28'in yanıtı 24'ün kilitli dönemdeki sınırını belirler.
- 35 (Mevcut Borç kartı dalı) ← 32 (b) / 2B-S3.
- K-2 ← 23 (alış faturasının uygulanma zamanı); K-2'nin A'sı EK-1 §1 alacak listesini AYNEN tutar, B'si listeden alış faturasını (ve Alacak Yaz sorusunu) çıkarır.
- K-3 ← S1 (verildi); K-3 = B seçilirse S1'in "kalan varken kapatılan taksit kartı" maddesi boşa düşer ve kitap H-07 / KG-23 değişir.

---

## 4. KULLANICIYA SORULACAKLAR (ders 43, 45; yanıta kadar kâhin iki dallı)

- **2B-S1 (madde 23):** Müşteri faturaya bağlamadan ödeme yaptı; ödemeden SONRA kaydedilen yeni bir satışın vadesi eski borcunkinden önce. Ödeme hangi borcu kapatmış sayılsın?
  **A (öneri):** Ödeme, yapıldığı gün açık olan borçları kapatır (vadesi en önce gelenden); sonradan doğan borca kaymaz. Örnek: 01.03 fatura 40.000 (vade 30.06) · 01.04 ödeme 40.000 · 10.05 vadesiz
  yeni fatura 40.000 → ödeme 01.03 faturasını kapatır; 11.05'ten itibaren yeni fatura gecikmiş 40.000, hatırlatma gider. Kapanmış fatura sonradan yeniden açılmaz; devir yapılsa da yapılmasa da sonuç aynı.
  **B:** Bütün bağsız ödemeler her seferinde yeniden, o güne kadarki bütün borçlara vadesi en önce gelenden dağılır. Aynı örnekte ödeme 10.05 faturasına kayar: 11.05'te gecikmiş 0, hatırlatma gitmez;
  01.03 faturası yeniden "Açık" görünür ve 01.07'den itibaren gecikmiş 40.000.
  Gerekçe: Borçlar Kanunu md. 102 ödemeyi ödeme anındaki borçlara sayar; "gecikmiş devirle değişmez" kuralı yalnız A ile tutar; ödenmiş belgenin sonradan "Açık"a dönmesi 2.0.17'deki "hayalet ödeme" şikâyetinin akrabasıdır.
- **2B-S2 (madde 28):** Kilitli (ya da devredilmiş) dönemde bağlamadan yapılan bir ödemeyle kapanmış faturaya, kilitten sonraki bir tahsilat "Kapatılacak Fatura" (ya da Mahsup Et / iade / kart tahsilatı)
  ile yönelirse ne olsun?
  **A (öneri):** Kilitli dönemdeki kapanış değişmez; yeni tahsilat bağlamadan yapılmış gibi vadesi en önce gelen açık borca sayılır (devirde arşivdeki faturaya bağlanan tahsilatla aynı kural); program
  bunu kayıtta söyler. Örnek: 01.11 F1 10.000 · 20.11 bağsız ödeme 10.000 (F1 kapanır) · 05.12 F2 10.000 (vade 31.03) · kilit 31.12 · 05.01 F3 10.000 (vadesiz) · 10.01 tahsilat 10.000 "Kapatılacak Fatura: F1"
  → tahsilat F3'ü kapatır; 11.01'de gecikmiş 0 — devir yapılsa da yapılmasa da.
  **B:** Bağ her zaman önce gelir: tek dosyada eski ödeme F2'ye kayar, F3 açık kalır, 11.01'de gecikmiş 10.000; devir yapılmış dosyada bu yapılamadığı için 0 — iki dosya nadiren farklı sonuç verir (BİLİNEN SINIR).
- **2B-S3 (madde 32):** Taksitlendirilmiş satıştan iade borçtan düşülünce (ya da kartın taksitlendirdiği fatura iptal edilince / silinince) kart o kadar küçülür. Küçülme hangi taksitlerden düşsün?
  **A (öneri):** Vadesi en önce gelen açık taksitten başlayarak (kart tahsilatıyla aynı sıra). Örnek: 3 × 3.000 taksit (vade 01.02, 01.03, 01.04), hiç ödenmemiş; 15.03'te 3.000 iade → 01.02 taksiti kapanır;
  15.03'te gecikmiş 3.000.
  **B:** Son taksitten geriye doğru (ödeme planı kısalır). Aynı örnekte 01.04 taksiti kalkar; 15.03'te gecikmiş 6.000.
  (İkisinde de: küçülme kartın açık kalanını aşarsa fazlası carinin avansı olur; parası geri verilen iadede kart değişmez.)
- **2B-S4 (K-2):** Aynı kişi hem müşterimiz hem tedarikçimiz: onun bize vadesi geçmiş satış borcu, bizim ona alış faturası borcumuz var. Ödeme Hatırlatma'daki gecikmiş tutarda bizim borcumuz düşülsün mü?
  **A (öneri):** Evet, düşülür: gecikmiş tutar hiçbir zaman carinin net borcunu aşmaz; bize alacaklı kişiye hatırlatma gitmez. Faturaların Açık / Ödendi durumu bugünkü gibi yalnız Mahsup Et ile değişir.
  **B:** Hayır, yalnız Mahsup Et yapılınca düşer; hatırlatma brüt tutarla gider.
  Örnek: 01.03 satış faturası 10.000 (vade 31.03, ödenmedi) · 10.03 alış faturası 6.000 (vade 30.04) · 15.04, cari bakiye 4.000 borçlu → A: gecikmiş 4.000; B: 10.000. Alış 12.000 olsaydı (cari bize 2.000 alacaklı) → A: 0, hatırlatma
  yok; B: 10.000, hatırlatma gider.
- **2B-S5 (K-3):** Kalanı olan taksit kartı Kartı Kapat ile kapatılınca kalan tutar ne olsun?
  **A (öneri):** Carinin borcunda kalır. Kartı Kapat yalnız ödeme planını bitirir; kalan, kapatma gününün ertesinden gecikmiş sayılır (S1 kararınızla aynı). Borcu silmek isterseniz ayrı ve görünür bir işlemle:
  Alacak Yaz ya da (dava / icra varsa) Şüpheli Alacağa Al → Değersiz Alacak Yaz. Daha önce kapatılmış kartlar olduğu gibi kalır.
  **B:** Borçtan düşer (bugünkü plan metinlerindeki davranış): kalan 689 Diğer Olağandışı Gider ve Zararlar'a gider yazılır, cari bakiyesi kapanır, hatırlatma gitmez; S1'deki "kalan varken kapatılan taksit
  kartı" maddesi boşa düşer.
  Örnek: 12 × 1.000 taksit kartı, 7 taksit ödendi, 15.06'da Kartı Kapat (kalan 5.000) → A: cari 5.000 borçlu kalır, 16.06'dan gecikmiş 5.000, hatırlatma gider, defterde kayıt yok; B: cari 0, defterde 689'a
  5.000 gider, hatırlatma yok.
  Gerekçe: alacaktan vazgeçme ancak belgeyle gider yazılır (VUK md. 322 değersiz alacak; aksi hâlde kanunen kabul edilmeyen gider) ve borçluyla anlaşma (ibra, Borçlar Kanunu md. 132) ister; planı kapatmak
  bunu kendiliğinden yapmamalı.

## 5. Kâhin için notlar

1. Madde 23 A: olay sırası = tarih → G-4 sınıfı (aynı gün borç kalemleri alacak kalemlerinden önce) → giriş sırası; devir açık kalemi asıl vade + asıl belge tarihiyle sıralanır.
2. Madde 24: bağ önceliği; serbest kalan bağsız ödemenin kendi tarihinde yeniden dağılması. 2B-S2 = A ise kilit tarihinden önceki bağsız kapanışlar donuk.
3. M2 değişmezi (iv): karşılaştırma devirli dosya ↔ aynı kilitle (L = K) devirsiz dosya; 2B-S2 = B ise madde 28 durumu yazılı istisna.
4. Madde 32: "kart_fark" kalemi kaldırılır; kart küçülür; değişmez: her kart ≤ alttaki borç (tükettiği kalemler) ve paralı iadede kart aynı.
5. Madde 33: s53'e "sonraya alma → ret, Kasa ve M-01 aynı" ve "aynı güne → kabul".
6. Madde 35: senaryolar — tahsilatsız kartlı fatura sil / iptal; tahsilatlı kartlı fatura sil (ret) / iptal (avans); Mevcut Borç kartının tükettiği faturayı iptal (kart küçülür, 2B-S3).
7. K-2: 2B-S4 = A → EK-1 §1 alacak listesi aynen; değişmez (i) korunur. B → alış faturası yalnız Mahsup Et bağıyla; değişmez (i) "≤ brüt satış borcu" olur.
8. K-3: 2B-S5 = A → H-07 / KG-23 A aynen, Kartı Kapat'ta defter maddesi yok, şüpheli caride alacak satırı yok; B → B 689 / A CH (şüpheli caride önce 128), M1(d) dalı kalkar.

## 6. BAŞ MİMAR KARARI olarak gösterilecekler (soru değil; ders 40)

Madde 24 (bağ önceliği; kılavuz "kayıt bu faturayı kapatır") · madde 32 (a) (kart kendisi küçülür; kılavuz) · madde 33 (Kasa açılışı ilk hareketten sonraya alınamaz; banka kuralının aynısı) ·
madde 35 (faturanın kendi kartı faturayla kalkar; 2.0.17 m1, S5).

## 7. DOĞRULANMADI / DENENMEYEN

- Birincil mevzuat metni açılamadı (`www.mevzuat.gov.tr` ENOTFOUND — oturumun ağ ayarlarında izinli değil): TBK md. 90, 101, 102, 132, 139, 143; VUK md. 322–324. Hepsi ikincil kaynak / arama özeti.
- Program belgeleri: Logo FIFO Close (`docs.logo.com.tr` ENOTFOUND, yalnız arama özeti), SAP müşteri–satıcı mahsubu ve ihtar (arama özeti), Microsoft Dynamics 365 net bakiye (arama özeti).
  Mikro ve Netsis'in cari kapama / yaşlandırma belgeleri bulunamadı → "yaygın uygulama" iddiaları GÖRÜŞ (görev tanımı §3: iki program belgesi şartı karşılanamadı).
- K-3'te programın bugün kalanı 689'a yazdığı yalnız plan / karar metinlerinden (BANKA-MODULU-PLAN §3.8, §3.11b; GECMIS-KARARLAR 743, 994–995); kod görülmedi.
- Madde 35: Mevcut Borç kartının tükettiği faturanın silinmesinde engel olup olmadığı; madde 33: açılıştan önce tarihli yeni Kasa hareketi — kural metni yok.
- DENENMEYEN: program kullanılmadı (bu tur metin turu).

## 8. Kaynaklar (erişim 05.11.2026; hepsi arama özeti, sayfa açılmadı)

- TBK md. 102: https://av-saimincekas.com/kanun/turk-borclar-kanunu/madde-102-tbk/ ; https://www.yontemymm.com.tr/yorum-ve-makaleler/yapilan-odemenin-dava-takip-fatura-borcuna-mahsuben-yapilip-yapilmadigi-konuk-yazar-smmm-huseyin-yorukoglu
- TBK md. 139 / 143 (takas; iki borç muaccel; beyan): https://av-saimincekas.com/kanun/turk-borclar-kanunu/madde-139-tbk/ ; https://av-saimincekas.com/kanun/turk-borclar-kanunu/madde-143-tbk/ ;
  https://hukukcularevi.com/tasfiye-param-hesabima-yatti-banka-kredi-borcuma-mahsup-etti-takas-tbk-139-144-muacceliyet-6502-28/
- TBK md. 132 (ibra): https://www.tahanci.av.tr/ibra-sozlesmesi/ ; https://www.muhasebetr.com/yazarlarimiz/umutciray/012/
- VUK md. 322 (değersiz alacak; kaza hükmü / kanaat verici vesika; tek taraflı beyan yetmez): https://www.alomaliye.com/2023/01/30/supheli-alacaklar-degersiz-alacaklar-ve-vazgecilen-alacaklar/ ;
  https://www.alomaliye.com/2026/05/07/iflas-karari-tek-basina-degersiz-alacak-kaydi-icin-yeterli-degil/ ; VUK md. 324 (borçlu yönünden vazgeçilen alacak): https://www.alomaliye.com/2006/08/05/borclu-yonunden-vazgecilen-alacaklar-ahmet-guzel-vergi-denetmeni/
- Logo FIFO Close ("kullanılmamış ters bakiyeli işlemlerden vadesi en yakın"; otomatik kapama elle kapatılmışları değiştirmez): https://docs.logo.com.tr/display/J3ERPENG/FIFO+Close
- SAP müşteri–satıcı mahsubu (ihtar programı ortak bakiye): https://help.sap.com/saphelp_globext607_10/helpdata/en/01/a9b247455711d182b40000e829fbfe/content.htm ;
  https://help.sap.com/saphelp_globext607_10/helpdata/en/01/a9be8b455711d182b40000e829fbfe/content.htm
- Microsoft Dynamics 365 müşteri / satıcı bakiye mahsubu: https://learn.microsoft.com/en-us/dynamics365/finance/cash-bank-management/net-customer-and-vendor-balances
- Önceki kaynaklar (kitap §10, EK-1 §8) aynen geçerli.

## 9. Sınır

Bu ajan lisanslı bir SMMM değildir; çıktısı mali müşavir görüşü ya da onayı yerine geçmez, mevzuat yorumunda yanılabilir. Bilanço ve Gelir Tablosu müşteriye sunulmadan önce gerçek bir SMMM
incelemesi önerilir (görev tanımı §7).
