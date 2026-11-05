# Muhasebeleştirme Kural Kitabı — EK-1: Kâhinin Belirsiz Bulduğu 14 Nokta (DestekOfis 2.5.0)

> **Bu ek programın kodu görülmeden yazıldı.** Kaynak: kural kitabı (`docs/erp/MUHASEBELESTIRME-KURAL-KITABI.md`), `docs/erp/MUHASEBE-CEKIRDEGI-PLANI.md`,
> `docs/devir/DEVIR-PLANI.md`, `docs/2.5.0-IS-LISTESI.md` (A, C, D), `CLAUDE.md`, görev tanımı `docs/erp/MALI-MUSAVIR-AJANI.md`, mevzuat ve yaygın uygulama kaynakları (§8).

Durum: TASLAK. Mali müşavir ajanı (kodu görmeyen), 05.11.2026 ~18:40 UTC. Depoya yazılmadı; baş mimar inceler.

Bağlayıcılık (kitap §0 ve ders 40, 43):
- **TÜRETİLDİ** ya da **TEKNİK TUTARLILIK** sınıfındaki öneriler önceki kararlardan ya da plan metninden çıkar; baş mimar kitaba işleyebilir, BAŞ MİMAR KARARI olarak kullanıcıya GÖSTERİLİR (§6).
- **KULLANICI KARARI GEREKİR** sınıfındakiler (para tutarı, kapama sırası, gecikmiş tanımı, kime hatırlatma gideceği) kullanıcı yanıt verene kadar kâhinde İKİ DALLI kalır; seçilmeyen dal kanıt sayılmaz. Sorular §5'te.
- Ürün sahibinin genel ilkesi (05.11): "en güncel mevzuata ve piyasadaki programların en yaygın kullandığı şekilde". 11 para kuralı "hepsi A" (iş listesi D).

Bağımsızlık beyanı: `server/`, `client/`, `tools/`, `packaging/`, `test/`, `.claude/worktrees/` altında hiçbir dosya açılmadı, listelenmedi, aranmadı. Okunan depo dosyaları: `CLAUDE.md`
(oturumla yüklendi), `docs/erp/MALI-MUSAVIR-AJANI.md`, `docs/erp/MUHASEBELESTIRME-KURAL-KITABI.md`, `docs/erp/MUHASEBE-CEKIRDEGI-PLANI.md`, `docs/devir/DEVIR-PLANI.md`,
`docs/2.5.0-IS-LISTESI.md` satır 1–150 (başlık, A, B, C, D; E okunmadı — B bölümü okuma aralığına girdi, bu ekte kullanılmadı). Kılavuz bu turda okunmadı.
Ağ: `mevzuat.gov.tr`, `resmigazete.gov.tr`, `docs.logo.com.tr` sayfaları açılamadı (WebFetch: ad çözülemedi / izinli değil); yalnız arama özetleri kullanıldı → birincil metin DOĞRULANMADI (§7).

---

## 0. Özet

| M | Konu | Öneri (A) — kısaca | Sınıf | Türetilme |
|---|---|---|---|---|
| M1a | Kuyruğun kapsamı | Tek kuyruk: açılış, fatura, Borç Yaz, karşılıksız evrak, devir açık kalemi, taksitler | TEKNİK | TÜRETİLDİ (G2, B1 A) |
| M1a | Bağsız ödemenin sırası | Vadesi ilk gelen (TBK 102) | KULLANICI KARARI (S2) | "en eski faturaya" iki okumalı |
| M1b | Vadesiz kalem | Vade = belge / işlem günü → ertesi gün gecikmiş | KULLANICI KARARI (S1) | — |
| M1c | Karşılıksız evrak borcu | Ayrı borç kalemi, vade = karşılıksız / iade günü | KULLANICI KARARI (S1) | — |
| M1d | Kapatılan kartın kalanı | Kapatma tarihli tek borç kalemi; vadesi S1 kuralıyla | KULLANICI KARARI (S1) | KG-23 A |
| M1e | Mevcut borcu taksitlendir | Kart alttaki kalemi TÜKETİR; yalnız taksitler sayılır | TEKNİK | TÜRETİLDİ (B1 A "taksitli faturada yalnız taksit") |
| M1f | Vade günü | Vade < bugün ise gecikmiş; tatil kaydırması yok | TEKNİK | TÜRETİLDİ (B1 A "vadesi geçmiş") |
| M2 | Devirde net açılışın vadesi | Vade devirle değişmez: her açık kalem kendi vadesiyle taşınır | TEKNİK (A'da) | TÜRETİLDİ (B1 A, §11.2) |
| M3 | KG-17 net tek madde | Defterde cari başına TEK satır = K bakiyesi (açık kalemler dahil) | TEKNİK | TÜRETİLDİ (KG-17 A, G14) |
| M4 | Önceki yılların kapanışı | K tarihli, kapanış sınıflı "Önceki Yıl Sonucu Fişi" (yıl yıl); 570 / 580 brüt | TEKNİK | TÜRETİLDİ (KG-12 A, kilit kuralı) |
| M5 | Eksi stok devri | Miktar = K'deki (eksi dahil), değer = 0; ortalamada eksi dönem başı = 0 | TEKNİK | TÜRETİLDİ (G3, KG-9 A) |
| M6 | Tahmini değerleme aralığı | [1 Ocak, t]; dönem [a, b] = T(b) − T(a−1) | TEKNİK | TÜRETİLDİ (KG-11 A, §8) |
| M7 | Kural Farkı Düzeltme Fişi | Aynı mali yıl → eski hesabın tersi; önceki mali yıl → 671 / 681; ilk açık gün; olağan sınıf | TEKNİK | TÜRETİLDİ (KG-15 A, TDHP) |
| M8 | Devirde KDV | 191 / 391 dönem etiketiyle açılır; yalnız Ocak etiketliler Ocak mahsubuna | TEKNİK | TÜRETİLDİ (KG-7 A, G4, G14) |
| M8-6 | Mahsuptan sonra 191'i alacaklandıran kayıt | Mahsupta NET hareket; düzeltme kendi ayına | KULLANICI KARARI (S4) | — |
| M9 | Devri Yenile çakışması | Yalnız tamamen kapanan / yok olan kalemde durur; kısmide fazla bağsız olur | TEKNİK | TÜRETİLDİ (G7, B1 A) |
| M10 | İptalde bağlı ödemeler | Yalnız formdaki peşin düşer; ayrıca bağlanan tahsilat avans kalır | KULLANICI KARARI (S5) | — |
| M11 | Yıl ortası K | YOK: K yalnız geçmiş bir yılın 31 Aralık'ı | TEKNİK | TÜRETİLDİ (DEVIR-PLANI §1, kitap §4) |
| M12 | Devirde cari ekstre | Satır tarihi K+1, asıl belge / vade açıklamada; bakiyesi 0 ve açık kalemsiz cariye satır yok | TEKNİK | TÜRETİLDİ (§11.3, G-6, G14) |
| M13 | Şüpheli alacak | J-01 kuyrukta kapama gibi (şüpheli kuyruğuna geçer); devirde 128 ayrı; hatırlatmaya girmez | TEKNİK + KULLANICI KARARI (S3) | J-01, §6.4 |
| M14 | Gider türü → hesap | 760 / 770 / 780 / 255 DOĞRU; ekler: 689, 770.90, VUK 313 haddi, KDVK 30 | TEKNİK | TÜRETİLDİ (F-06, genel ilke) |

---

## 1. Ortak model: Tek Yükümlülük Kuyruğu (TYK) — M1, M2, M9, M12, M13 buna dayanır

Kâhin "gecikmiş" (B1) ve devir açık kalemlerini tek bir modelden hesaplamalıdır; aşağıdaki model §2'deki A seçenekleriyle yazıldı (S1–S3 dalları belirtilmiştir).

1. **Kuyruk carinin CH hareketlerinden kurulur (128 hariç — 128 ayrı "şüpheli kuyruğu", M13).** Her kalem: yön (borç = cari bize borçlanır / alacak), tutar, belge tarihi `d`,
   vade `v`, giriş sırası `s`.
   - Borç kalemleri: satış faturası, Borç Yaz, borçlu açılış (M-02, KG-16 onaylı açılış), karşılıksız / iade evrak (Ç-07), müşteriye para iadesi (T-09), devir açık kalemi (N-10),
     taksit kartı taksitleri (aşağıda), kapatılan kartın kalanı (M1d).
   - Alacak kalemleri: tahsilat (her yol, çek / senet alma dahil), Alacak Yaz, alacaklı açılış, satıştan iade faturası, alış faturası (aynı caride), Kredi Kartına İade vb.
   - `v`: kalemin açık vadesi; yoksa S1-A'da `v = d`, S1-B'de `v = ∞` (hiç gecikmez).
2. **Taksit kartları (H-01, H-02):** kart açıldığı gün kart tutarı kadar kuyruk kalemini TÜKETİR (kapama gibi; "Bu Satışı Taksitlendir" → o fatura; "Carinin Mevcut Borcu" → açık borç
   kalemleri, adım 4'teki sırayla). Kartın her taksiti kendi vadesiyle borç kalemi olur. **H-03 Yeni Borç ve KG-5 A Excel kartı:** borcun kaynağı karttır; kuyruğa yalnız taksitleri girer
   (kart toplamı ayrıca girmez). Değişmez: kart ile alttaki borç ASLA birlikte sayılmaz (ders 32 K1 ailesi).
3. **Bağlar önce:** fatura formundaki peşin ödeme, Kapatılacak Fatura, Mahsup Et, çek / senet bağı, kart tahsilatı kendi hedefini kapatır (en çok hedefin kalanı kadar); fazlası bağsız
   alacak olur. (DEVIR-PLANI eski §4.2: "önce bağlı ödeme, kalan FIFO" — programın kapama düzeninin plan metnindeki tarifi.)
4. **Bağsız alacak kalemleri havuzlanır** ve açık borç kalemlerine şu sırayla uygulanır: S2-A: vade `v` artan → eşitse belge tarihi `d` → eşitse giriş sırası `s` (ders 31);
   S2-B: `d` artan → `s`. Sonuç: açık borç kümesi, sıralı listenin SONUNDAKİ kalemlerdir (toplamı = Σ borç − Σ alacak, artıysa).
5. **gecikmiş(t)** = Σ { açık borç kalemi kalanı : `v` < t } (M1f). `t` = şirketin yerel tarihi (Europe/Istanbul), sahte saat (`config.now`) ile (ders 13, 22).
6. **Değişmezler:** (i) 0 ≤ gecikmiş(t) ≤ max(0, CH bakiyesi(t)); (ii) Σ açık borç − Σ açık alacak = CH bakiyesi; (iii) aynı cari için cari kartı = cari listesi = Anlık Durum =
   WhatsApp seçimi = Vade Takip gecikmiş tutarı (çekirdek planı §9.11); (iv) M2-A seçilirse her t ≥ K+1 için gecikmiş(t) devirli dosyada = devirsiz dosyada.

Not: TBK 102 "birden çok muaccel borçtan ilk takibe uğrayana" der; takipteki (dava / icra) alacak bu programda şüpheli kuyruğundadır (M13) ve şüpheli caride tahsilatın yönünü
program zaten kullanıcıya sordurur (kitap T-13 — TBK 101: borçlunun / makbuzun beyanı). Eşit vadede TBK "oranlı" der; model belge tarihi + giriş sırası kullanır (toplam gecikmiş
aynı, yalnız kalem bazında kalan değişir) → TEKNİK.

---

## 2. Maddeler

### M1 — B1 gecikmiş borç ayrıntısı (Ödeme Hatırlatma / WhatsApp kime gider)

Önceki karar (iş listesi D, kullanıcı 05.11 17:16, aynen): "B1 gecikmiş borca vadesi geçmiş fatura kalanı da girer (taksitli faturada yalnız taksit; çekle kapanan sayılmaz;
bağsız tahsilat en eski faturaya; devir açık kalemi kendi vadesiyle)".

#### M1(a) — Kuyruğun kapsamı ve bağsız tahsilatın sırası
1. **ÖNERİ (A):** Tek kuyruk (§1): açılış bakiyesi satırları, fatura kalanları, vadeli / vadesiz Borç Yaz, karşılıksız evrak borcu, devir açık kalemi, taksitler AYNI kuyrukta. Bağsız
   alacak kalemleri borç kalemlerine **vadesi ilk gelenden** başlayarak uygulanır (eşit vadede belge tarihi, sonra giriş sırası).
   Gerekçe: TBK 102 — ödemenin hangi borca olduğu belirtilmemişse önce muaccel borca, birden çoksa ilk takibe uğrayana, takip yoksa **vadesi ilk gelene**; vadeler aynıysa oranlı
   (av-saimincekas TBK 102, ikincil). Logo FIFO kapama: "diğer kapamalarda kullanılmamış ters bakiyeli işlemlerden **vadesi en yakın** olan" (Logo J3 "FIFO Close", arama özeti).
   Kaynak ayrımı yapılmaması: TBK 102 borcun kaynağına bakmaz; DEVIR-PLANI G2 "2.4.5'ten beri tarihli elle borç satırlarının kapandığı tek yükümlülük kuyruğu".
   Yaygın uygulama: Logo belgesi (tek program) → GÖRÜŞ.
2. **SEÇENEK B (kâhin):** belge tarihi en eski kalemden. Sonuç: eski tarihli ama uzun vadeli (ör. 01.03, vade 30.06) belge kapanır, sonraki tarihli kısa vadeli (ör. 10.05 peşin) açık
   kalır → 11.05'ten itibaren gecikmiş görünür ve hatırlatma gider; A'da gitmez. Vadesiz kalemlerde S1-A seçilirse (vade = belge tarihi) A ile B aynı sonucu verir; fark yalnız açık vade
   yazılmış kalemlerde.
3. **SINIF:** kapsam (tek kuyruk) → TEKNİK TUTARLILIK; sıra (vade ↔ belge tarihi) → **KULLANICI KARARI GEREKİR** (kapama sırası, kime hatırlatma) — S2.
4. **TÜRETİLDİ:** kapsam — G2 "tek yükümlülük kuyruğu" + B1 A. Sıra türetilemez: B1 A'daki "en eski faturaya" hem "vadesi en eski" hem "belgesi en eski" okunabilir.

#### M1(b) — Vadesi girilmemiş kalem (vadesiz fatura / açılış / Borç Yaz)
1. **ÖNERİ (A):** vade = belge / işlem tarihi → ertesi gün gecikmiş. Gerekçe: TBK 90 — ifa zamanı kararlaştırılmamışsa her borç doğumu anında muaccel olur (ikincil). Yaygın programlarda
   ödeme planı / vade girilmeyen belgenin vadesi belge tarihidir → GÖRÜŞ (program belgesine erişilemedi). TTK 1530 tacirler arası mal / hizmet tedarikinde ödeme günü yoksa faturanın
   alınmasından 30 gün sonra ihtarsız temerrüt öngörür (ikincil) — bu FAİZ / TEMERRÜT içindir; hatırlatma bir bilgilendirmedir, temerrüt beklemez.
   Ekran notu (TEKNİK): fatura / Borç Yaz formunda Vade boşsa "Peşin (Belge Tarihi)" yazsın — gizli varsayım olmasın.
   Geçiş etkisi: güncellemeden sonraki ilk Ödeme Hatırlatma listesi birden uzayabilir (eski vadesiz faturalar, açılışlar). Hatırlatmanın kendiliğinden çalışan turu varsa ilk tur ön izleme
   + onayla geçmeli ("kime kaç kez", ders 45) — WhatsApp planı bu turda okunmadı (DOĞRULANMADI).
2. **SEÇENEK B (kâhin):** vadesiz kalem gecikmiş sayılmaz. Sonuç: vade alanı boş bırakılan faturalar ve Excel açılış bakiyeleri hiç hatırlatma almaz; B1 A'nın ("fatura kalanı da girer")
   etkisi yalnız vadesi yazılmış faturalarla sınırlı kalır. (C — öneri değil: vade = belge + 30 gün, TTK 1530; yalnız tacirler arası dayanaklı → şirket ayarı olarak 2.5.1.)
3. **SINIF:** **KULLANICI KARARI GEREKİR** (gecikmiş tanımı, kime hatırlatma) — S1.
4. **TÜRETİLDİ:** hayır. B1 A "vadesi geçmiş" vadesiz kalem için iki okumaya izin verir.

#### M1(c) — Karşılıksız / iade evrak yüzünden yeniden borçlanma (Ç-07)
1. **ÖNERİ (A):** Ç-07 ayrı bir borç kalemi; belge tarihi = karşılıksız / iade işlemi günü; vade = aynı gün (ödeme aracı ödenmedi, alttaki borç muacceldir — TBK 90 mantığı) → ertesi gün
   gecikmiş. Evrakla kapanmış fatura YENİDEN AÇILMAZ (borç Ç-07 kalemindedir; çift sayım yok). B1 A "çekle kapanan sayılmaz" evrak portföyde / tahsilde / cirodayken geçerlidir;
   karşılıksızdan sonra borç artık "çekle kapanmış" değildir. (A', aynı sınıf: vade = evrakın vadesi; gecikmiş tutarı aynı, yalnız gün sayısı farklı — öneri A, geriye tarihli vade yazmaz.)
2. **SEÇENEK B (kâhin):** vadesiz → gecikmiş değil (S1-B ile aynı).
3. **SINIF:** **KULLANICI KARARI GEREKİR** — S1'in kapsamında sorulur (ayrı soru gerekmez).
4. **TÜRETİLDİ:** kısmen — "çekle kapanan sayılmaz" (B1 A) karşılıksızda geçerli değildir; vadenin ne olduğu S1'e bağlı.

#### M1(d) — Kapatılan taksit kartının kalanı
1. **ÖNERİ (A):** Kartı Kapat (kalan > 0; KG-23 A: alacak CH'de kalır) → kartın ödenmemiş taksitleri kuyruktan çıkar; kalan, **kapatma tarihli tek borç kalemi** olur; vadesi S1 kuralıyla
   (S1-A: kapatma günü → ertesi gün gecikmiş; S1-B: gecikmez). Gerekçe: kart kapanınca ödeme planı biter; borç silinmez, ertelenmez. Kartı Kapat penceresi söyler: "Kalan X TL carinin
   borcunda kalır ve Ödeme Hatırlatma'ya girer. Silmek için Alacak Yaz kullanın." (çıkmaz yok, ilke 4).
2. **SEÇENEK B (kâhin):** sayılmaz. Sonuç: S1-A seçilse bile kartı kapatmak hatırlatmayı durdurmanın gizli yolu olur; defterde borç durur, hiçbir ekranda "gecikmiş" görünmez.
3. **SINIF:** **KULLANICI KARARI GEREKİR** — S1'in kapsamında.
4. **TÜRETİLDİ:** "kalan CH'de kalır" KG-23 A'dan; gecikmiş sayılması S1'e bağlı.

#### M1(e) — "Mevcut borcu taksitlendir" kartında çift sayım
1. **ÖNERİ (A):** §1 adım 2: kart açıldığı gün kart tutarı kadar alttaki kalemi TÜKETİR; kuyrukta yalnız kartın taksitleri kendi vadeleriyle durur; kart tahsilatı önce o kartın vadesi ilk
   gelen taksitini kapatır. Kısmi yapılandırmada (kart tutarı < açık borç) tüketilecek kalemler M1(a) sırasıyla (S2). Değişmez: Σ açık borç − Σ açık alacak = CH bakiyesi.
   Gerekçe: yapılandırmada taraflar yeni ödeme planında anlaşır; eski vadeler artık uygulanmaz (GÖRÜŞ — yenileme / novasyon tartışması DOĞRULANMADI).
2. **SEÇENEK B:** alttaki kalemler kendi vadeleriyle sayılır, kart yalnız bilgi. Sonuç: B1 A "taksitli faturada yalnız taksit" kararına aykırı; kart ile alttaki borç birlikte sayılırsa gecikmiş
   bakiyeyi aşar (değişmez (i) kırmızı).
3. **SINIF:** TEKNİK TUTARLILIK (çift sayım önleme). Kısmi yapılandırmanın sırası S2'ye bağlı.
4. **TÜRETİLDİ:** B1 A "taksitli faturada yalnız taksit" (H-01) + aynı ilkenin H-02'ye benzetmesi; ders 32 K1 (kart yeni satış sayılmaz).

#### M1(f) — Vade günü
1. **ÖNERİ (A):** gecikmiş ⇔ vade < bugün (vade günü gecikmiş değildir). "bugün" = şirketin yerel tarihi (Europe/Istanbul), sahte saat ile. Vade resmî tatile / hafta sonuna denk gelirse
   kaydırma YAPILMAZ (yaygın yaşlandırma raporları kaydırmaz — GÖRÜŞ; TBK'nin ifa günü tatile denk gelirse izleyen iş günü kuralı DOĞRULANMADI) → BİLİNEN SINIR, 2.5.1'de banka tatil
   takvimiyle.
2. **SEÇENEK B:** vade ≤ bugün → vade günü sabahı hatırlatma gider; borçlunun o gün ödeme hakkı varken "gecikmiş" denir.
3. **SINIF:** TEKNİK TUTARLILIK.
4. **TÜRETİLDİ:** B1 A "vadesi **geçmiş**" — geçmiş = bugünden önce.

### M2 — Devirde açık kalem dışında kalan net açılışın vadesi
1. **ÖNERİ (A) — "Vade devirle değişmez":** K'de TYK'da açık kalan HER borç kalemi — fatura kalanı (G2) yanında vadeli / vadesiz Borç Yaz kalanı, açılış kalanı, karşılıksız evrak borcu,
   kapatılmış kart kalanı — kendi belge tarihi ve vadesiyle AYRI devir açık kalemi olarak taşınır (satır tarihi K+1, açıklama "Devir: <belge no / tür> (<belge tarihi>)", vade = asıl vade;
   M12). Taksit kartının tükettiği kalemler taşınmaz (kart, taksit dağılımıyla kalır — G3). Net açılış satırı yalnız kalanı taşır: K'de açık ALACAK (avans, fazla ödeme) ya da kartların
   karşıladığı kısım — ikisi de gecikmiş hesabına borç kalemi olarak girmez, vadesi önemsizdir.
   Değişmez (kâhin): her cari ve her t ≥ K+1 için gecikmiş(t) ve açık kalem (vade, kalan) listesi devirli dosyada = devirsiz dosyada.
   Gerekçe: DEVIR-PLANI §11.2 (cari bakiye tipi seçenekleri arasında "fark ekstrede görünüşte"); B1 A "devir açık kalemi kendi vadesiyle"; Netsis SSS: vadesi devir tarihinden sonraki çek /
   senet ve banka kayıtları yeni yıla AYNEN aktarılır (arama özeti) — cari için iki programın belgesi bulunamadı → GÖRÜŞ.
2. **SEÇENEK B:** G2 metni (yalnız fatura ayrı) + net satırın vadesi K+1 (DEVIR-PLANI eski §4.2 son satırı; G2 ile yerine geçti). Sonuç: vadesi henüz gelmemiş Borç Yaz (ör. vade 15.02)
   01.01'de "vadesi gelmiş" olur (S1-A'da 02.01'de gecikmiş → erken hatırlatma); gecikmiş kalemlerin gün sayısı sıfırlanır.
   **SEÇENEK C (kâhin):** net satır vadesiz. Sonuç: S1-A'da C = B; S1-B'de K'de gecikmiş olan vadeli Borç Yaz / açılış kalanları devirden sonra gecikmiş olmaktan ÇIKAR → hatırlatma kesilir.
   Kâhinin "hiçbir carinin gecikmiş durumu devirden önce ve sonra değişmez" iddiası yalnız K'de fatura dışı vadeli açık kalem YOKSA doğrudur; A her durumda sağlar.
3. **SINIF:** A seçilirse TEKNİK TUTARLILIK (bakiye de hatırlatma da devirden etkilenmez); B ya da C seçilecekse KULLANICI KARARI (kime hatırlatma değişir). A, G2'nin kapsamını fatura dışına
   genişlettiği için BAŞ MİMAR KARARI olarak gösterilir.
4. **TÜRETİLDİ:** B1 A ("devir açık kalemi kendi vadesiyle") + DEVIR-PLANI §11.2.

### M3 — KG-17: cari başına "net tek madde" ile açık kalemler
1. **ÖNERİ (A):** Defterde cari başına TEK açılış satırı = carinin K bakiyesi (CH muavini; 128 hariç — N-12), açık kalemler DAHİL. Açık kalemler, "Borç Toplamı / Alacak Toplamı" ya da tek
   bakiye satırı yalnız cari modülünde (ekstre, vade, kapama) görünür; defterde ayrı madde üretmez. Yer: Devir Açılış Fişi (N-09 / N-13; K+1, açılış sınıfı), karşı taraf 519. Sıfır tutarlı satır
   yazılmaz (G-6). Gerekçe: açılış kaydı kapanış bilançosunun hesap / muavin bazında tersidir (TDHP yaygın uygulaması); Netsis'te modül devir kayıtları ile muhasebe açılış fişi ayrı tutulur,
   farkları denetim listesinden izlenir (arama özeti); KG-17 A "defterde cari başına NET tek açılış maddesi"; G14 "yeni yıl mizanında önceki yılın cirosu taşınmaz".
2. **SEÇENEK B (kâhin):** her açık kalem ayrı madde + kalan için net madde. Sonuç: bakiyeler aynı; yeni yıl mizanının borç / alacak sütun toplamları ve Büyük Defter satır sayısı büyür; bakiyesi
   0 ama ters yönlü açık kalemi olan caride iki madde (+X / −X).
3. **SINIF:** TEKNİK TUTARLILIK.
4. **TÜRETİLDİ:** KG-17 A + G14.

### M4 — KG-12 A: kapanmamış önceki yılların değerleme ve sonuç fişi
1. **ÖNERİ (A):** Önceki yıllar için HİÇBİR fiş o yılların tarihine yazılmaz. Devir kapanışında (arşiv, **K tarihli, kapanış sınıfı**, devir işleminin kendi kilit / dondurma adımıyla aynı işlemde —
   çekirdek Ç2 notu) her kapanmamış önceki yıl Y için ayrı bir **"Önceki Yıl Sonucu Fişi (Y)"**:
   - Y yılında tarihli 6 ve 7 sınıfı hareketlerinin hesap başına net tutarı ters kayıtla kapatılır (gelir hesabı borç, gider / maliyet hesabı alacak; ters bakiyeli hesap ters yönde);
   - **A 153** = SMM_Y = DBS_Y + alış_Y − alış iadesi_Y − DSS_Y (§5; DBS_Y = DSS_(Y−1), ilk yıl M-07);
   - karşı taraf: R_Y = Σ gelir_Y − Σ gider_Y − SMM_Y; R_Y > 0 → **A 570** (alt hesap 570.Y önerilir), R_Y < 0 → **B 580** (580.Y).
   Aynı gün sıra: Önceki Yıl Sonucu Fişleri (eskiden yeniye) → N-01 → N-02 … N-07. **N-01 tutarı = SMM_(K yılı) = DSS_(K−1) + alış − iade − DSS_K** (§5.2 tanımı; "153 bakiyesi − DSS"
   ancak önceki yıl fişlerinden SONRA bu tutara eşittir). Değişmez: bütün kapanıştan sonra 153 = DSS_K; 570 = Σ kârlı önceki yıllar, 580 = Σ zararlı önceki yıllar; 590 / 591 = yalnız K yılı.
   Kapanıştan hemen önceki Bilanço'da "Geçmiş Yıllar — Kapanmamış" hesaplanmış satırının 570 / 580 kısımları bu tutarlara eşit (KG-12 A "kapanışta ve Bilanço'da hesaplanmış satırda").
   Gerekçe: (1) kilitli / donmuş döneme fiş yazılmaz (çekirdek Ç2 409, Ç3; kitap R-03) — Y'nin 31.12'si kilitliyse kâhinin seçimi uygulanamaz; (2) kapanış sınıfı Gelir Tablosu'na girmez
   (kitap §4) → K yılının Gelir Tablosu önceki yılların maliyet ve sonucuyla kirlenmez; (3) Y yılının kendi tarihli raporları (kilitli / donmuş) değişmez; Y'nin 31.12 Bilanço'su hesaplanmış
   satır ve KG-11 A tahmini değerlemeyle gösterilmeye devam eder. Y kilitli değilse de AYNI yol (tek kod yolu).
   570 / 580: **yıl yıl brüt** — kârlı yıllar 570'e, zararlı yıllar 580'e; birbirinden mahsup YOK. TDHP'de 570 ve 580 ayrı hesaplardır; geçmiş yıl zararının kârlardan mahsubu şirketin
   yetkili organının kararıdır (DOĞRULANMADI), program yapmaz.
2. **SEÇENEK B (kâhin):** Y'nin 31.12'si, Y'nin kendi kapanış akışı. Sonuç: Y kilitliyse ya devir durur (yeni engel) ya donmuş döneme madde eklenir (kitap §8 "kilitli dönemin maddeleri değişmez"
   bozulur). 570 / 580 netleştirme seçeneği: özkaynak toplamı aynı, TDHP hesap ayrımı kaybolur.
3. **SINIF:** TEKNİK TUTARLILIK (özkaynak toplamı ve K Bilanço'su iki seçenekte aynı; yalnız tarih / satır).
4. **TÜRETİLDİ:** KG-12 A ("yıl yıl ayrılır … 570 / 580'e") + Ç2 / R-03 kilit kuralı + kitap §4 (kapanış sınıfı Gelir Tablosu dışı).

### M5 — KG-9 A: yıl sonunda eksi miktarlı ürünün devri
1. **ÖNERİ (A):** Yeni yıl açılış MİKTARI = K'deki miktar (eksi dahil; ör. −15 Adet); açılış DEĞERİ = 0 (153 açılışında o ürün 0). Yeni yılın ortalama maliyetinde eksi dönem başı miktar
   **0 sayılır**: birim maliyet = (0 + alış M − alış iadesi M) ÷ (0 + alış miktarı − alış iadesi miktarı); payda ≤ 0 ise KG-10 (kart alış fiyatı, yoksa 0 + uyarı). "Kesin Değil — Eksi Stok"
   nedeni miktar ≥ 0 olana kadar sürer. Devir Raporu'nda "Eksi Stokla Devreden Ürünler" listesi.
   Gerekçe: DEVIR-PLANI G3 "stock_moves (açılış K+1, **miktar K'deki**, değer ağırlıklı ortalama)" ve kitap §6.4 (modül bakiyeleri iki dosyada eşit); miktar 0'lanırsa Ocak'ta gelen Aralık
   alış faturası ürünü hayalî +15'e çıkarır (sayımla çelişir). Değer 0 = KG-9 A. Eksi dönem başı miktarın ortalamaya katılması sıfıra bölme ya da anlamsız birim maliyet üretir.
   Bilinen sonuç: eksiye düşen adetlerin maliyeti önceki yılın satışların maliyetinde yoktur, yeni yılınkine girer (eksik alış belgesinin doğal sonucu).
2. **SEÇENEK B (kâhin):** miktar 0 + değer 0. Sonuç: stok modülü devirde değişir (§6.4 ihlali), Ocak alışından sonra hayalî stok.
3. **SINIF:** TEKNİK TUTARLILIK.
4. **TÜRETİLDİ:** G3 (miktar) + KG-9 A (değer 0) + kitap §6.4.

### M6 — KG-11 A: yıl ortasında tahmini değerlemenin alış aralığı
1. **ÖNERİ (A):** t itibarıyla tahmini (KG-11 A) için aralık **[1 Ocak, t]** (t'nin yılı); DBS = önceki yıl sonu DSS (devir açılışı varsa o). Birikimli tahmini maliyet T(t) = DBS değeri + alış
   [1 Ocak, t] − alış iadesi − DSS_t. Gelir Tablosu [a, b] tahmini satışların maliyeti = **T(b) − T(a − 1)** (a = 1 Ocak ise T(a − 1) = 0) → aylar toplamı = çeyrek = yıl. t = K'de tahmini =
   N-01 (aynı işlev). Kitap §5.1'deki "1 Ocak – K" yalnız yıl sonu kesin değerlemesi içindir.
   Gerekçe: t itibarıyla rapor t'den sonraki alıştan etkilenmemeli (aynı rapor her açılışta aynı sayı); geçici vergi dönemlerinde stoklar dönem sonu (yılbaşından birikimli) itibarıyla değerlenir
   (muhasebenews 2024/2 geçici vergi stok değerlemesi, arama özeti — GÖRÜŞ); kitap §8 değişmezi "Gelir Tablosu (1 Ocak → t) Dönem Kârı = Bilanço hesaplanmış Dönem Net Kârı (aynı t)".
2. **SEÇENEK B (kitabın harfî okuması):** [1 Ocak, K ya da bugün]. Sonuç: geçmiş tarihli rapor sonradan girilen alışla değişir; Ocak–Mart raporu Eylül'de farklı çıkar; [a, b] dönemleri toplanmaz.
3. **SINIF:** TEKNİK TUTARLILIK (defter değişmez; yalnız "Tahmini" rapor satırı).
4. **TÜRETİLDİ:** KG-11 A ("dönemsel ağırlıklı ortalama", "Gelir Tablosu + Bilanço birlikte") + kitap §8.

### M7 — KG-15 A: Kural Farkı Düzeltme Fişi — hesap, tarih, sınıf
1. **ÖNERİ (A):**
   - **Tarih:** fiş oluşturulurken dönem kilidinin ertesi günü (ilk açık gün = kilit tarihi + 1). **Sınıf:** olağan (Gelir Tablosu'na girer). Ç2 saklanan fiş, tür "Kural Farkı Düzeltme",
     ön izleme + onay (KG-15 A).
   - **Hesap:** farkı doğuran kilitli hareket düzeltme fişiyle **aynı mali yıldaysa** → eski kuralın kullandığı sonuç hesabının tersi (ör. B 602 / A 519; B 519 / A 770) — o yılın sonucu yıl
     sonunda doğru çıkar (KG-15 A örneğinin kendisi). **Önceki bir mali yıldaysa** → gelir yönlü düzeltme **671 Önceki Dönem Gelir ve Kârları**, gider yönlü düzeltme **681 Önceki Dönem Gider
     ve Zararları** (ör. eski kural açılış çekini 602'ye gelir yazmışsa B 681 / A 519; 770'e gider yazmışsa B 519 / A 671). Yalnız bilanço içi fark (eski 500 ↔ yeni 519): B 500 / A 519 ya da
     ters; sonuç hesabı yok. Arşivlenmiş (devredilmiş) yıldaki fark da yeni yılın ilk açık gününe aynı kuralla.
   - Gelir Tablosu: 671 → I Olağandışı Gelir ve Kârlar, 681 → J Olağandışı Gider ve Zararlar; dipnot: "Önceki dönem kural farkı düzeltmesi — vergi matrahı bakımından mali müşavirinizle
     değerlendirin (681 genellikle kanunen kabul edilmeyen gider; geçmiş yıl için düzeltme beyannamesi gerekebilir)". **671 ve 681 hesap planına EKLENECEK** (kitap §2'de yok).
   Gerekçe: TDHP 671 / 681 tanımı — önceki dönemlere ait olup hata ya da unutulma nedeniyle o dönemin tablolarına alınamamış tutarlar; dönem sonunda 690'a kapanır (muhasebetr, muhasebenews,
   arama özetleri; 681 tutarlarının KKEG sayılması aynı kaynak). 602 cari yılın "A Brüt Satışlar"ındadır — önceki yılın düzeltmesi burada cari satışları eksiltir; 770'te cari faaliyet giderini
   şişirir. Dönem net kârı 602 / 770 ile 671 / 681 arasında AYNIDIR.
2. **SEÇENEK B:** her durumda 602 / 770 (KG-15 A örneğinin harfiyen uygulanması; kâhinin seçimi). Sonuç: net kâr aynı; cari yılın Brüt Satışlar / Faaliyet Giderleri satırları önceki yılın
   tutarıyla bozulur. (C, değerlendirildi, önerilmez: doğrudan 570 / 580 — KÜMİ FRS / TMS 8 geçmişe dönük düzeltme yaklaşımı; cari yıl kârını değiştirir ve KG-15 A'nın "ilk açık güne
   düzeltme fişi" sözüyle çelişir → seçilirse KULLANICI KARARI.)
3. **SINIF:** A ↔ B TEKNİK TUTARLILIK (net kâr aynı, yalnız Gelir Tablosu satırı); C seçilecekse KULLANICI KARARI.
4. **TÜRETİLDİ:** KG-15 A ("ilk açık güne … fiş"; örneği sonuç hesapları üzerinden) + TDHP 671 / 681 tanımı. Tarih ve sınıf kâhinle aynı.

### M8 — KG-7 A: devirde KDV (190, 191, 391, 360)
1. **ÖNERİ (A):**
   1. 191 ve 391 **KDV dönemi** boyutuyla izlenir: 191'de "KDV İndirim Dönemi" (KG-7 A alanı; boşsa belge ayı), 391'de belge ayı. Alanın üst sınırı belgenin takvim yılını izleyen yılın
      Aralık'ı (KDVK 29/3 — ikincil).
   2. V-01 (ay M) satırları **dönem etiketine göre** seçer, tarihe göre değil (açılış sınıfındaki satırlar dahil).
   3. Devir açılışı (N-13, K+1, açılış sınıfı): 190, 191 (dönem boyutuyla), 391 (dönem boyutuyla), 360 K bakiyeleri AYNEN.
   4. Ocak mahsubu: D = 190 bakiyesi (açılıştan gelen "Önceki Dönemden Devreden İndirilecek KDV"); İ = dönemi Ocak olan 191 (açılıştaki etiketli Aralık belgeleri + Ocak kayıtları);
      H = dönemi Ocak olan 391. **Dönemi ≤ Aralık olan 191 / 391 açılışları yeni yılın HİÇBİR mahsubuna girmez**; Bilanço'da brüt görünür + Kesin Değil "Aralık KDV Mahsubu Yapılmamış";
      tek yol Devri Yenile (arşivde Aralık mahsubu → yeni yıl açılışı 190 ya da 360 olarak yeniden üretilir). G4 bunu devirden önce uyarır.
   5. Aralık mahsubu yapılmışsa 360 açılışı Ocak'taki Vergi Ödemesi (V-02) ile kapanır; 190 açılışı Ocak mahsubunun D'sidir.
   Gerekçe: KDV beyannamesinde önceki dönemden devreden KDV (190) ile bu döneme ait indirilecek KDV (191) ayrı satırlardır; Aralık beyannamesi Ocak'ta verilir ama Aralık dönemine aittir;
   Aralık'ın 191 / 391'i Ocak mahsubuna katılırsa iki ayın KDV'si birleşir, beyanname ile defter ayrışır. Mahsupta 191 > 391 farkı 190'a, 391 > 191 farkı 360'a (muhasebenews 190 / 191
   kayıt örnekleri, arama özeti).
   6. **(S4) Mahsuptan sonra 191'i alacaklandıran kayıt:** V-01'de İ = dönemi M olan 191 **NET** hareketi (borç − alacak; mahsup fişinin kendi satırları hariç), H = dönemi M olan 391 net
      hareketi (alacak − borç). Mahsuptan SONRA girilen ve 191'i alacaklandıran kayıt (ör. faturalı banka masrafının ters kaydı R-01 — KG-18 A ile ters kaydın girildiği gün) KENDİ tarihinin
      ayına etiketlenir, o ayın İ'sini azaltır (net eksiyse ödenecek KDV'yi artırır) → 191 eksiye düşmez. Açık dönemde mahsubu yapılmış ayın bir kaydı düzenlenirse (G-7 yeniden türetme) o ay
      için "KDV Mahsubu Güncel Değil (fark X TL)" uyarısı + Kesin Değil; düzeltme mahsup ekranında Geri Al + yeniden (R-03). Engel konmaz (yeni kural sayılmaz; ders 45).
      Gerekçe: KDV'de iade / vazgeçme düzeltmesi düzeltmenin yapıldığı dönemde yapılır (KDVK 35 — DOĞRULANMADI); kitap V-01'deki "191 borç hareketi" ifadesi dar yazılmıştır (P turunun
      eksiği): brüt formülde ters kaydın alacağı hiçbir mahsuba girmez, 191 kalıcı eksi ve 190 fazla kalır.
2. **SEÇENEK B:** (1–5 için) Aralık'ın 191 / 391 açılışları da Ocak mahsubuna girer → Aralık ve Ocak KDV'si tek fişte birleşir, beyannameyle uyuşmaz. (6 için) kitabın bugünkü metni — yalnız
   borç hareketi → 191'de eksi kalıntı, devreden KDV fazla.
3. **SINIF:** 1–5 TEKNİK TUTARLILIK; 6 **KULLANICI KARARI GEREKİR** (aylık 360 / 190 tutarı değişir) — S4, öneri A güçlü.
4. **TÜRETİLDİ:** 1–5 KG-7 A ("KDV İndirim Dönemi" alanı) + DEVIR-PLANI G4, G10 (20), G14 ("191 bakiyesi açılışla yeni yıla"; Aralık mahsubu devirden sonra yalnız Devri Yenile ile).
   Kâhinin seçimi ("etiketli girer, etiketsiz girmez — yalnız Devri Yenile ile") A ile aynı. 6 türetilemez.

### M9 — Devri Yenile: "çakışma" ne zaman
1. **ÖNERİ (A):** ÇAKIŞMA (işlem durur, liste gösterilir) yalnız düzeltmeyle **tamamen kapanan ya da yok olan** açık kalem / açılış satırına K sonrası BAĞ varsa — bağın hedef satırı yenilemede
   kalkacağı için bağ sahipsiz kalır (G7 aynen; kâhinle aynı). Kalanı K sonrası bağlı ödemenin ALTINA inen kalemde durmaz: bağ korunur (deterministik kimlik, yerinde güncelleme — G7), bağlı
   ödeme kalan kadar kapatır, FAZLASI bağsız alacak olur ve TYK'ya girer (§1 adım 3). Devir Raporu: "Bağı Değişen Ödemeler" (cari, ödeme, eski / yeni kapattığı tutar) ve "Gecikmiş Tutarı Değişen
   Cariler" — Devri Yenile onayında gösterilir. Düzeltme yeni bir açık kalem doğurursa (geç gelen Aralık faturası — asıl kullanım) çakışma yoktur; Ocak'ın bağsız tahsilatları S2 sırasıyla yeniden
   dağılabilir (gecikmiş değişebilir; düzeltmenin doğal sonucu).
   GÖRÜŞ (öneri değil): tamamen kapanan kalemde de durmak yerine G2'deki "kapanmış ≤K fatura bağı arşiv başvurusuna çevrilir" kuralı uygulanabilir; akış kesilmez. G7 bugün "durur" diyor —
   seçim baş mimarın.
2. **SEÇENEK B:** kısmi düşüş de çakışma → Devri Yenile, iade faturası gibi olağan Aralık düzeltmelerinde sık durur; kullanıcı bağları elle çözmek zorunda kalır.
3. **SINIF:** TEKNİK TUTARLILIK (bakiyeler iki seçenekte aynı; fazlanın bağsız olması genel kapama kuralı).
4. **TÜRETİLDİ:** G7 + B1 A ("bağsız tahsilat en eski …") + §1 adım 3.

### M10 — F-15: fatura iptalinde düşen "bağlı ödemeler"
1. **ÖNERİ (A, kâhinle aynı):** İptal faturanın kendi maddelerini (F-01 / F-05) ve **fatura formunda girilmiş peşin ödeme satırlarını** (fatura ile tek belge) birlikte kaldırır. **Ayrıca girilmiş**
   tahsilat / ödeme (Kapatılacak Fatura bağı, Mahsup Et, çek / senet bağı, taksit kartı tahsilatı) SİLİNMEZ: bağ çözülür, tutar carinin bağsız alacağı / borcu (avans) olur ve TYK'ya girer.
   İptal penceresi iki durumu da söyler: "Fatura ile girilen X TL peşin ödeme de iptal edilecek; para iade edilmediyse önce ayrı tahsilat olarak kaydedin." / "Bu faturaya ayrıca bağlanmış
   Y TL ödeme cariye avans olarak kalacak."
   Gerekçe: ayrı girilmiş tahsilat ayrı bir para olayıdır (kitap G-5); fatura iptali parayı geri vermez, Kasa / banka fiziksel parayla ve banka ekstresiyle eşleşmeye devam eder. Logo'da kapama
   kaldırılınca tahsilat açık kalır, kapalı (peşin) fatura iptalinde kasa işlemi de iptal olur — GÖRÜŞ (belge açılamadı). Kitapta F-12 ("ayrı olay") ile F-15 ("bağlı ödemeleri yok sayılır")
   arasındaki belirsizlik böyle giderilir: F-15'teki "bağlı ödemeler" = yalnız formdaki peşin.
2. **SEÇENEK B:** ayrıca bağlanmış tahsilatlar da düşer → Kasa / banka bakiyesi fiziksel paradan sapar, banka hareketi ekstreyle eşleşmez. (C, değerlendirildi: hiçbiri düşmez — peşin de
   avans kalır; formun bütünlüğü bakımından A önerilir.)
3. **SINIF:** **KULLANICI KARARI GEREKİR** (kasa / banka tutarı) — S5.
4. **TÜRETİLDİ:** hayır. Kılavuzda "İptal Et" davranışı yazılıysa o metin önceden yazılmış karar sayılır (ders 40) — bu turda kılavuz okunmadı (DOĞRULANMADI).

### M11 — Kesim tarihi K yıl ortası olabilir mi
1. **ÖNERİ (A):** HAYIR. K yalnız **geçmiş bir takvim yılının 31 Aralık'ı**. Program yıl ortası K'yi reddeder; kâhin üreteci yıl ortası K üretmez, reddi sınar.
   Gerekçe: DEVIR-PLANI §1 adım 2 ("yalnız geçmiş bir yıl sonu seçilebilir; ileri tarih yok"); kitap §4 ("Mali yıl = takvim yılı; özel hesap dönemi desteklenmez → BİLİNEN SINIR"); çekirdek §13
   (özel hesap dönemi 2.5.1); VUK 174 — hesap dönemi takvim yılıdır, özel hesap dönemi Bakanlık izniyle ve 12 aylık; serbest meslekte yok (ikincil). Yıl ortası K'de kapanış fişi yılın bir
   kısmının sonucunu "dönem net kârı" yapar; KG-12 yıl yıl ayrımı ve Defter Türü raporları bozulur.
2. **SEÇENEK B (kâhin):** izin verir → kapanış yasal döneme uymaz; 590 / 591 yarım yıl sonucu taşır.
3. **SINIF:** TEKNİK TUTARLILIK.
4. **TÜRETİLDİ:** DEVIR-PLANI §1 + kitap §4 (önceden yazılmış karar metni — kâhin kendi üretecini düzeltir).

### M12 — Devirde cari ekstre gösterimi; bakiyesi 0 cari
1. **ÖNERİ (A):**
   - Satır tarihi **K+1** (01.01). Açık kalemin asıl belge no ve tarihi açıklamada ("Devir: <belge no> (<belge tarihi>)"), **Vade** sütununda asıl vade (M2 A). Yeni yıl dosyasına ≤K tarihli
     satır yazılmaz (kilit = K; kitap §6.6 hareket sayısı değişmezi).
   - Aynı gün sıra (açılış sınıfı): (1) "Devir — Borç Toplamı", (2) "Devir — Alacak Toplamı" ("Sadece Bakiyeyi Aktar"da yalnız "Devir Bakiyesi"), (3) açık kalemler vade sırasıyla (eşitse
     belge tarihi). Kümülatif bakiye son devir satırında K bakiyesine eşit.
   - Borç Toplamı = arşivde ≤K bütün borç hareketleri (açılışlar dahil) − devreden açık BORÇ kalemleri; Alacak Toplamı = ≤K bütün alacak hareketleri − devreden açık ALACAK kalemleri;
     fark = K bakiyesi − Σ açık kalemler (G2 formülü).
   - Sıfır tutarlı satır yazılmaz. **Bakiyesi 0 ve açık kalemi olmayan cariye HİÇ satır yazılmaz — iki seçenekte de.** Bakiyesi 0 ama açık kalemi olan caride açık kalemler + sıfır olmayan
     toplam satırları yazılır.
   Gerekçe: DEVIR-PLANI §11.3 ("bakiyesi 0 olan cariye açılış satırı yazılmaz"), kitap G-6, G14 (3) (ekstrede "Borç Toplamı" / "Alacak Toplamı" açık kalemler düşülmüş + açık kalemler kendi
   tarih ve vadesiyle — burada "kendi tarihi" açıklamada, satır tarihi K+1).
2. **SEÇENEK B:** "Borç ve Alacakları Aktar"da bakiyesi 0 cariye de iki eşit satır (eski yılın cirosu ekstrede; bazı programlarda böyle olabilir — DOĞRULANMADI); açık kalem satırı asıl belge
   tarihiyle (≤K) → kilitli döneme satır, hareket sayısı değişmezi bozulur.
3. **SINIF:** TEKNİK TUTARLILIK.
4. **TÜRETİLDİ:** §11.3 + G-6 + G14 (3) + G2.

### M13 — J-01 şüpheli alacak: açık kalem dağıtımı ve devirde 128
1. **ÖNERİ (A):**
   - J-01 TYK'da **kapama gibi davranır**: aktarılan tutar CH kuyruğunun açık borç kalemlerinden M1(a) sırasıyla (dava / icra safhasındaki alacak çoğunlukla en eski vadeli olandır — VUK 323)
     çıkar, ayrı **şüpheli kuyruğuna (128)** geçer. Kalem ÖDENMİŞ sayılmaz (fatura durumu "Şüpheli Alacakta"). J-03 (şüpheliden tahsilat) bu kuyruğu kapatır (T-13'te kullanıcı yön seçer —
     TBK 101 beyanı); J-05 Değersiz → kalemler değersiz olarak kapanır; J-06 Şüpheliden Çıkar → kalemler kendi vadeleriyle CH kuyruğuna döner.
   - **Devir:** şüpheli kuyruğundaki kalemler CH'ye devir açık kalemi OLARAK TAŞINMAZ; 128 / 129 N-12 ile açılır (doubtful_receivables açık kalır — G3); fatura başvurusu (belge no) şüpheli
     kaydında korunur. Değişmez: carinin bakiyesi (CH + 128 muavini) K = K+1 (kitap §6.4) ve CH açılışı + Σ CH açık kalemleri = CH bakiyesi (128 hariç) — aynı tutar iki kez taşınmaz.
   - **(S3) Gecikmiş:** şüpheli kuyruğundaki tutar cari kartında / Anlık Durum'da "Şüpheli" diye AYRI gösterilir; otomatik Ödeme Hatırlatma'ya GİRMEZ (dava / icra safhasında borçluyla
     iletişim hukuki süreçten yürür); hatırlatma ekranında "Şüpheli alacağı var" etiketiyle elle seçilebilir (çıkmaz yok, ilke 4).
   - Not: İşletme hesabı esasında şüpheli alacak karşılığı ayrılamaz (VUK 323 — ikincil) → Defter Türü İşletme Hesabı Esası iken Karşılık Ayır uyarı vermeli (2.5.1, DÜŞÜK).
2. **SEÇENEK B:** J-01 kuyruğu etkilemez (fatura açık kalır). Sonuç: devirde aynı tutar hem CH açık kalemi hem 128 açılışı olarak İKİ KEZ taşınır (cari bakiye büyür) ya da CH açılışı yapay
   alacaklı satır olur; gecikmiş şüpheli tutarı içerir ve hatırlatma dava / icra safhasındaki borçluya gider.
3. **SINIF:** kuyruk ve devir → TEKNİK TUTARLILIK (çift sayım önleme; bakiye değişmez); hatırlatma → **KULLANICI KARARI GEREKİR** (S3).
4. **TÜRETİLDİ:** kuyruk / devir — kitap J-01 ("cari bakiyesi (120 + 128 muavini) değişmez"), §6.4, G3. Hatırlatma türetilemez.

### M14 — F-06 gider türü → hesap eşlemesi
1. **ÖNERİ (A):** Eşleme DOĞRU (TDHP 7/A): satış / pazarlama / dağıtım → **760** (raporda 631); genel yönetim → **770** (632); finansman (kredi faizi, kredi masrafı, kart gecikme faizi,
   bunların BSMV / KKDF'si) → **780** (660); demirbaş → **255**. Ekler:
   - 255: aktifleştirme VUK 313'ün genel kuralıdır. KDV hariç bedeli haddi aşmayan kıymeti doğrudan gider yazmak mükellefin SEÇİMİDİR (2026 haddi 12.000 TL — ikincil kaynak, GİB duyurusu
     DOĞRULANMADI) → 2.5.1'de "Küçük Demirbaş (Doğrudan Gider)" türü (770). Amortisman yok → 255 brüt + kalıcı dipnot (kitap §7.5 (2)).
   - Taşıt (254), tesis / makine (253), hak / yazılım (260) türleri programda yoksa 255'e düşer → dipnot; 2.5.1 düzenlenebilir hesap planı.
   - Para cezası, gecikme zammı / faizi → **689** (KKEG; kitap V-03), 770 değil — gider türü listesinde böyle bir tür varsa.
   - Gider türü seçilmemiş / tanınmayan → **770.90 Sınıflandırılmamış** (kitap G-8).
   - KDVK 30 kapsamında indirilemeyecek KDV (ör. binek otomobil alımı / kiralaması, kanunen kabul edilmeyen giderlerin KDV'si) 191'e değil gidere eklenmeli — program ayırmıyorsa BİLİNEN
     SINIR + dipnot (DOĞRULANMADI).
   - 7/A ticaret işletmeleri için serbesttir (kitap §10); 7/A kalır (çekirdek §13 KABUL).
2. **SEÇENEK B:** hepsi 770 → Gelir Tablosu'nda satış ve finansman giderleri görünmez; demirbaş gidere → kâr düşük, aktif eksik.
3. **SINIF:** TEKNİK TUTARLILIK (760 / 770 / 780 arasında dönem kârı aynı; 255 mevzuatın genel kuralı). Doğrudan gider seçeneği 2.5.1 (kullanıcıya bilgi).
4. **TÜRETİLDİ:** kitap F-06 + genel ilke "en güncel mevzuat" (VUK 313) + çekirdek §13 (7/A).

---

## 3. Kitaba işlenecek düzeltmeler (baş mimar onayıyla; BAŞ MİMAR KARARI olarak gösterilir)

| # | Yer | Düzeltme | Kaynak |
|---|---|---|---|
| E1 | §1 / yeni §1A | Tek Yükümlülük Kuyruğu modeli (bu ekin §1'i) | M1, M2, M13 |
| E2 | §2 hesap planı | 671 Önceki Dönem Gelir ve Kârları, 681 Önceki Dönem Gider ve Zararları EKLENECEK (GT I / J) | M7 |
| E3 | §5.1 | "1 Ocak – K" yalnız kesin değerleme; tahmini t'de [1 Ocak, t]; [a, b] = T(b) − T(a−1); eksi dönem başı miktar ortalamada 0 | M5, M6 |
| E4 | N-01, N-08 | N-01 tutarı = K yılının SMM'si (§5.2); N-08 = "Önceki Yıl Sonucu Fişi (Y)", K tarihli, kapanış sınıfı, 570 / 580 yıl yıl brüt | M4 |
| E5 | N-10, N-13 | Açık kalem kapsamı fatura dışı kalemleri de içerir (M2 A); defterde cari başına tek net satır (M3) | M2, M3 |
| E6 | Ç-07, H-07 | Ç-07 ayrı borç kalemi (vade S1); Kartı Kapat kalanı kapatma tarihli tek kalem (vade S1) | M1c, M1d |
| E7 | V-01 | İ / H dönem etiketine göre ve (S4-A ise) NET hareket; mahsup fişinin kendi satırları hariç | M8 |
| E8 | F-15 | "bağlı ödemeler" tanımı (S5'e göre) | M10 |
| E9 | §4 | K yalnız geçmiş bir yılın 31 Aralık'ı | M11 |
| E10 | §3-Ş J-01 | Şüpheli kuyruğu; devirde 128 ayrı (çift taşıma yok) | M13 |

## 4. Kâhin için yeni değişmezler

1. 0 ≤ gecikmiş(t) ≤ max(0, CH bakiyesi(t)) — her cari, her t (S3-A'da 128 hariç).
2. Σ açık borç kalemi − Σ açık alacak kalemi = CH bakiyesi; taksit kartı ile alttaki borç birlikte sayılmaz.
3. Gecikmiş tutarı bütün ekranlarda ve WhatsApp seçiminde aynı (çekirdek §9.11).
4. (M2 A) Her t ≥ K+1 için gecikmiş(t) ve açık kalem (vade, kalan) listesi devirli = devirsiz; Devri Yenile sonrası da (düzeltmenin kendi etkisi dışında).
5. (M3) Yeni yıl açılış fişinde cari satırı = arşiv K CH muavin bakiyesi; cari başına en çok bir satır.
6. (M4) Kapanıştan sonra 153 = DSS_K; 570 = Σ kârlı önceki yıllar; 580 = Σ zararlı önceki yıllar; 590 / 591 yalnız K yılı; K yılının Gelir Tablosu önceki yıl fişlerinden etkilenmez.
7. (M5) Açılış miktarı = K miktarı (eksi dahil); eksi üründe 153 değeri 0.
8. (M6) t = K'de tahmini SMM = N-01; aylık tahminlerin toplamı = yıllık.
9. (M7) Kural Farkı Fişi'nden sonra 1–5 sınıfı bakiyeleri (59x ve hesaplanmış satırlar hariç) yeni kuralla baştan türetilmiş defterle aynı; fark yalnız dönem sonucunda (671 / 681 ya da ilgili
   sonuç hesabı).
10. (M8) Mahsubu yapılmış ve sonrasında değişmemiş ayda dönemi o ay olan 191 ve 391 = 0; 191 hiçbir anda eksi değil (S4-A); yeni yıl Ocak mahsubu dönemi ≤ Aralık olan hiçbir satırı içermez.
11. (M11) K ≠ 31 Aralık → program reddeder.
12. (M12) Bakiyesi 0 ve açık kalemi olmayan cari için yeni yılda devir satırı yok; ≤K tarihli satır yok.
13. (M13) CH + 128 cari bakiyesi K = K+1; aynı tutar hem CH açık kalemi hem 128 açılışı olamaz.

## 5. KULLANICIYA SORULACAKLAR (ders 43, 45 — "kime kaç kez" ve para; yanıta kadar kâhin iki dallı)

- **S1 (M1 b, c, d):** Vadesi yazılmamış bir borç (vadesiz fatura, açılış bakiyesi, vadesiz Borç Yaz, karşılıksız çıkan çek / senet, kalan varken kapatılan taksit kartı) ertesi günden
  itibaren "gecikmiş" sayılıp Ödeme Hatırlatma'ya girsin mi?
  **A (öneri):** Evet — vadesi belge / işlem günü sayılır (Borçlar Kanunu md. 90: süresi belirlenmemiş borç hemen ödenir). Güncellemeden sonraki ilk hatırlatma listesi uzayabilir; ilk tur ön izlemeyle.
  **B:** Hayır — yalnız vadesi açıkça yazılmış borç gecikmiş sayılır.
- **S2 (M1 a, M1 e):** Müşterinin faturasına bağlamadan yaptığı ödeme önce hangi borcunu kapatsın?
  **A (öneri):** Vadesi en önce gelen borcunu (Borçlar Kanunu md. 102; Logo'nun FIFO kapaması). **B:** Belge tarihi en eski borcunu.
- **S3 (M13):** Şüpheli alacağa alınmış (dava / icra safhasındaki) borç otomatik Ödeme Hatırlatma'ya girsin mi?
  **A (öneri):** Hayır — cari kartında ayrı görünür, istenirse elle seçilir. **B:** Evet — öteki gecikmiş borçlarla aynı.
- **S4 (M8-6):** KDV mahsubundan sonra girilen ve indirilecek KDV'yi azaltan bir kayıt (ör. faturalı banka masrafının ters kaydı) hangi ayın mahsubunda hesaba katılsın?
  **A (öneri):** Girildiği ayın mahsubunda (o ayın indirilecek KDV'sini azaltır; KDV hesabı eksiye düşmez). **B:** Hiçbir mahsupta (indirilecek KDV hesabında eksi kalıntı, devreden KDV fazla kalır).
- **S5 (M10):** Bir fatura iptal edilince, faturaya sonradan ayrıca bağlanmış tahsilat (Kapatılacak Fatura) da silinsin mi?
  **A (öneri):** Hayır — tahsilat cariye avans olarak kalır; yalnız fatura formunda girilen peşin ödeme faturayla birlikte iptal olur. **B:** Evet — bağlı bütün ödemeler faturayla birlikte silinir.

## 6. BAŞ MİMAR KARARI olarak gösterilecekler (soru değil; ders 40 gereği gerekçesiyle)

M1a kapsam (tek kuyruk) · M1e (kart alttaki borcu tüketir) · M1f (vade < bugün, tatil kaydırması yok) · M2 A (açık kalem kapsamı fatura dışına genişler; kâhinin C seçimi değişir) ·
M3 (cari başına tek net satır; kâhinin seçimi değişir) · M4 (K tarihli Önceki Yıl Sonucu Fişi; kâhinin seçimi değişir) · M5 (miktar devri eksi dahil; kâhinin seçimi değişir) · M6 ·
M7 (önceki mali yılda 671 / 681; kâhinin seçimi kısmen değişir) · M8 1–5 · M9 · M11 (kâhinin seçimi değişir) · M12 · M13 kuyruk / devir · M14.

## 7. DOĞRULANMADI / DENENMEYEN

- Birincil metin açılamadı (mevzuat.gov.tr, resmigazete.gov.tr erişilemedi): TBK md. 90, 92–93, 101, 102 (ikincil: av-saimincekas); TTK md. 1530 (ikincil: erdem-erdem); VUK md. 174, 313
  (2026 haddi 12.000 TL ikincil), 323; KDVK md. 29/3, 30, 35; MSUGT 671 / 681 tanımı (ikincil); geçmiş yıl zararının kârlardan mahsubu kuralı.
- Program belgeleri: Logo J3 "FIFO Close" ve Netsis "Sene Sonu Devir" yalnız arama özetinden (docs.logo.com.tr bu oturumun ağ ayarlarında izinli değil — açılması için o alan adının izinli
  olması gerekir). Mikro, Wolvox, Luca, Zirve, ETA belgelerine ulaşılamadı → "yaygın uygulama" iddiaları GÖRÜŞ (görev tanımı §3: iki program belgesi şartı karşılanamadı).
- Kılavuzdaki "İptal Et", "Kartı Kapat" metinleri ve WhatsApp Ödeme Hatırlatma'nın kendiliğinden çalışan bir turu olup olmadığı bu turda okunmadı.
- DENENMEYEN: program kullanılmadı (bu tur plan / kitap turu; ekran, PDF, Excel denetimi A ve S turlarında).

## 8. Kaynaklar (erişim 05.11.2026; hepsi arama özeti, sayfa açılmadı)

- TBK 90 (süreye bağlanmamış borç): https://av-saimincekas.com/kanun/turk-borclar-kanunu/madde-90-tbk/
- TBK 102 (kanuna göre mahsup sırası): https://av-saimincekas.com/kanun/turk-borclar-kanunu/madde-102-tbk/
- TTK 1530 (mal ve hizmet tedarikinde geç ödeme, 30 gün): https://www.erdem-erdem.av.tr/bilgi-bankasi/mal-ve-hizmet-tedarikinde-gec-odemenin-sonuclari
- Logo FIFO kapama (vadesi en yakın ters bakiyeli işlem): https://docs.logo.com.tr/display/J3ERPENG/FIFO+Close
- Netsis Sene Sonu Devir SSS (vadesi devir tarihinden sonraki çek / senet ve banka kayıtları aynen; devir kayıtları ile açılış fişi farkı denetim listesi):
  https://docs.logo.com.tr/download/attachments/50684716/Netsis%20S%C4%B1k%C3%A7a%20Sorulan%20Sorular-SeneSonuDevir.pdf?api=v2 ,
  https://docs.logo.com.tr/download/attachments/66255863/Sene%20Sonu%20Devir-2022.pdf?api=v2
- 671 / 681 (önceki dönem gelir / gider; 690'a kapanış; 681 KKEG): https://www.muhasebetr.com/yazarlarimiz/alirizaakbulut/0123 , https://www.muhasebenews.com/?p=148634 ,
  https://www.muhasebetr.com/tekduzenhesapplani
- 190 / 191 kayıt örnekleri (mahsup farkı 190 / 360): https://www.muhasebenews.com/?p=168316 , https://www.muhasebenews.com/?p=168317
- Şüpheli alacak (VUK 323; dava / icra şartı; işletme hesabında karşılık yok): https://www.alomaliye.com/2021/03/08/supheli-alacaklar/ ,
  https://alomaliye.com/2021/01/11/supheli-ticari-alacaklar-ve-karsiliklarinin-degerlemesi/
- VUK 313 doğrudan gider haddi 2026 (12.000 TL): https://www.muhasebetr.com/demirbas-amortisman-siniri
- VUK 174 özel hesap dönemi: https://www.muhasebetr.com/yazarlarimiz/mustafaalpaslan/0338/ , VUK GT 245: https://www.alomaliye.com/1995/12/25/vergi-usul-245/amp/
- Geçici vergi döneminde stok değerlemesi: https://www.muhasebenews.com/?p=153508
- Önceki kaynaklar (kitap §10) aynen geçerli.

## 9. Sınır

Bu ajan lisanslı bir SMMM değildir; çıktısı mali müşavir görüşü ya da onayı yerine geçmez. Bilanço ve Gelir Tablosu müşteriye sunulmadan önce gerçek bir SMMM incelemesi önerilir (görev tanımı §7).
