# Cari kâhini bakımı 21 — karar girdisi (ana oturum yazdı; TEK girdi kaynağın)

Bu dosya, cari kâhininin bakım 20'sinden sonra çıkan ve cari kâhinine dokunan kararları taşır: Ç7b paketinin kayıt tahsilatı kuralı (KG-3) ve kural geçiş günü, taksit kartında
'Kartı Kapat' (Borçta Kalsın / KG-23), taksit kartında tahsilatı olan faturanın iptali (S15) ve şüpheliye aktarılmış faturaya bağlı tahsilatın ayrıntıları (S25).
OKUMA KURALI: soru metinlerinde geçen 'program bugün', 'bugünkü davranış', 'koşuldu', 'tur …', 'test' sözleri ve oradaki sayılar KURAL KAYNAĞI DEĞİLDİR — kural yalnız KARAR satırlarıdır
(seçilen seçeneğin metni), kitap satırlarıdır ve aşağıdaki KAPSAM satırlarıdır. Kararın söylemediği alt durumda kural UYDURULMAZ: o alanda SUS ve raporun 'KULLANICIYA SORULMALI'
listesine yaz (ders 40, 43). Etiketler: 'KULLANICI KARARI', 'KULLANICI KURALIYLA ÖNERİ UYGULANDI' (kullanıcının 14.11 06:31 kuralı — kullanıcı değiştirebilir), 'BAŞ MİMAR KARARI' /
'BAŞ MİMAR YORUMU' (kullanıcıya gösterildi; aynı etiketle yaz). Kullanıcının 06:31 kuralı (AYNEN):
KULLANICI 14.11 06:31 UTC (AYNEN: "bana sorun varsa önerilerini uygula") — S175–S179 YANITLANDI = öneriler: S175 = C (valörlü kendi-hesap transferi bugünkü gibi; 108.90 yok; kural kitabının K-07 / KG-19'undan sapma BİLİNEN SINIR — teslim notuna ve iş listesi B'ye; 2.5.1'de A'ya geçilebilir; kâhinin KG-19 senaryosu bu kullanıcı kararıyla bakımda güncellenir — ders 40: netleştirme kullanıcı kararından), S176 DÜŞTÜ, S177 = A (komisyon farkı değişikliğin / valörün gününde), S178 = A (KG-6 yalnız BSMV / vergisiz kipte; KDV kipi bugünkü gibi), S179 = A (açılıştan önceki hesapsız hareket: ilgili yolun en geç açılış tarihi ya da Devir Kapanışı gününden önceyse 519, değilse Hesabı Atanmamış; kovanın ekran bakiyesi aynı satırları düşer). BAŞ MİMAR YORUMU (kullanıcıya gösterilecek; değiştirebilir): ileti ileriye dönük de okunur — bundan sonra soru yine turun SON iletisinde öneriyle YAZILIR, öneri BEKLEMEDEN uygulanır ('kullanıcı kararıyla öneri uygulandı' diye işaretlenir), kullanıcı istediğinde değiştirir; 6 dakikalık bekleme gerekmez. Kapsam uzakta çalışma yetkisininkiyle aynı: para / defter kuralı ve fren sorusu dahil (öneri geri alınabilir seçenekten yana), DAHİL DEĞİL: PR → master 'birleştir', yayın, canlı Supabase / DNS / Cloudflare dağıtımı, müşteri / kimlik bilgisi, gizli anahtarlar. DÖNÜŞ LİSTESİ'ndeki [1]–[6] ve baş mimar kararları kullanıcı itiraz etmediği için geçerli kalır. SONRAKİ: Ç7a tur 2'nin görev metni üreteçle (KG-6, K-14 / K-15 kodlanır; KG-19 kodlanmaz — S175 = C; satır kurucuya yalnız okuyan ekler; kart formundaki alan adı); başlama koşulu tur 2e'nin ana dala girmesi + boş ajan yeri.

## C1. KG-3 — kayıt tahsilatının karşılığı (KULLANICI KARARI 05.11 'hepsi A')
KİTAP SATIRI (AYNEN; sütunlar: kimlik | olay | bugün | seçenek A | seçenek B | karar …):
| KG-3 K | Carisiz tahsilat (Kasa + Tahsilat; eski kayıt tahsilatı) | 649.90 Sınıflandırılmamış Gelir | Gelir DEĞİL: 336.90 "Sınıflandırılmamış Tahsilatlar" (pasif) + Kesin Değil | Kayıt tahsilatı B (icra / müvekkil emaneti olabilir, GİB SM rehberi); Kasa + Tahsilat A |
KULLANICI KARARI (AYNEN):
- KULLANICI KARARI (05.11 17:16 UTC, aynen: "hepsi A") — mali müşavir P'nin 11 para kuralı sorusu, A seçenekleri: (1) B1 gecikmiş borca vadesi geçmiş fatura kalanı da girer (taksitli
KAPSAM (baş mimar): kitabın KG-3 satırının kararlı sütunu — kayıt tahsilatının karşılığı GELİR DEĞİL, 336.90 'Sınıflandırılmamış Tahsilatlar' (pasif). Cari kâhininin mizan / defter
beklentilerinde kayıt tahsilatının karşılığı hangi hesaptaysa bu sütuna geçir; eski → yeni beklentiyi G3'te yaz. 336.90'ın üst hesabı (336) mizanda göründüğü düzeyde beklenir — kâhinin
mizanı ana hesap düzeyindeyse 336, alt hesap düzeyindeyse 336.90 (hangi düzeyi beklediğini yorumda yaz).

## C2. Kural geçiş günü — kilitli eski veride KG-3'ün eski yönü (B-8; KULLANICI KURALIYLA ÖNERİ UYGULANDI, BAŞ MİMAR KARARI 19.11)
KARAR (AYNEN; 19.11 05:07): bu ÜÇ kuralın yeni yönü KURAL GEÇİŞ GÜNÜ'nden sonraki kayıtlara uygulanır — geçiş günü güncellemedeki kilit tarihi (kilitsiz dosyada geçiş yok, hepsi yeni kural); geçişten önceki kayıtlar ESKİ yönde kalır (kilit sonradan açılıp kapansa da — belirleyici, tek tanım).
KARAR (AYNEN; 19.11 05:07): B-6 BUNUNLA BİRLEŞİR: KG-8 / F-08'de ayrıca güncellemeden önce KDV mahsubu yazılmış ayların iade KDV'si eski yönde (mahsup ters kaydedilip yeniden yazılırsa o ay yeni yöne geçer).
KARAR (AYNEN; 19.11 05:07): BİLİNEN SINIR (teslim notuna): geçişten önceki kilitli kayıt tahsilatları 602'de, iade KDV'leri eski yönde kalır.
KAPSAM (baş mimar): 'üç kural'dan cari kâhinine dokunan yalnız KG-3'tür (kayıt tahsilatı). 'ESKİ yön' = kitap satırının 'bugün' sütununun sözü (kayıt tahsilatı B) ve kâhinin kendi
eski beklentisi; 'geçiş günü' = programın bu sürüme güncellendiği andaki kilit tarihi; güncellemede kilit yoksa geçiş YOK, bütün kayıtlar yeni yön. Kâhinin dili 'eski sürümde kilitlenmiş
veri + güncelleme' sırasını kuruyorsa kur; kuramıyorsa bütün kayıtlar yeni yön (kilitsiz güncelleme) diye kur ve bunu yorumda yaz — SUS + DENENMEYEN.

## C3. Taksit kartında 'Kartı Kapat' — Borçta Kalsın (KG-23 = A; 2B-S5 / S10 = A)
KİTAP SATIRI (AYNEN):
| KG-23 | Kalan varken Kartı Kapat | Alacak CH'de kalır (madde yok) | Kalan değersiz sayılır | A |
KULLANICI KARARI (AYNEN):
(6) 2B-S5 / S10 = A "Borçta Kalsın": Kartı Kapat yalnız ödeme planını bitirir; kalan carinin borcunda kalır, ertesi günden gecikmiş, hatırlatma gider; vazgeçme ayrı ve görünür işlemle (Alacak Yaz
KAPSAM (baş mimar): kalan varken Kartı Kapat yalnız ödeme planını bitirir — carinin bakiyesi DEĞİŞMEZ, kapatılan kartın kalan kalemleri carinin borcunda (kendi vadeleriyle) kalır,
ertesi günden gecikmiş sayılır ve hatırlatmaya girer; kalan 'değersiz sayılmaz' (madde yok). Vazgeçme (alacak yazma) ayrı ve görünür işlemdir. Kâhinin dilinde Kartı Kapat yoksa
EKLEME — SUS + DENENMEYEN + 'SÜRÜCÜ İÇİN' satırı.

## C4. Taksit kartında tahsilatı olan faturanın İptal Et'i (S15 = A)
SORU (AYNEN):
S15 (R5): taksit kartında tahsilatı olan faturanın İptal Et'i — A öneri: iptal kabul; kart kapanır, kartın tahsilatları carinin avansı olur (S5 ve EK-2B 35 ile aynı kural) / B: reddedilir,
KARAR (AYNEN):
S15 = A: taksit kartında tahsilatı olan faturanın İptal Et'i kabul; kart kapanır, kartın tahsilatları carinin avansı olur (S5 / EK-2B 35 ile aynı).
KAPSAM: iptal kabul; kart kapanır; kartın o faturaya ait tahsilatları carinin bağsız alacağı (avans) olur. Dil fatura iptalini ve taksit kartını aynı senaryoda kuramıyorsa DENENMEYEN.

## C5. Şüpheliye aktarılmış faturaya bağlı tahsilatın ayrıntıları (S25 = A)
SORU (AYNEN):
S25 (S14 ayrıntıları): (a) kısmen şüpheliye aktarılmış faturaya iki kısmın toplamından küçük çek — A öneri: önce şüpheli kısım (128) düşer, kalan 120 / B: önce 120; (b) çekin faturanın açık kısmını aşan
KARAR (AYNEN):
S25 = A: (a) kısmen şüpheliye aktarılmış faturaya küçük çek → önce şüpheli kısım (128), kalan 120; (b) çekin açık kısmı aşan fazlası → carinin bağsız alacağı (avans, 120); (c) nakit / havale / POS ile
KAPSAM: kâhin S25'i zaten modelliyorsa yeni kural YAZMA — her kol (a, b, c) için en az bir senaryoyla beklenenin karara uyduğunu göster; modellemediği kolda kur, eski → yeni G3'te.
