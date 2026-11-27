# ANA OTURUM — muhasebe kâhini bakımı 13 + defter kâhini bakımı 4 (TOPLU KÂHİN BAKIMI; Ç7b paketi) karar girdisi ve görev metni üreteci.
# Kararlar iş listesinden, kural kitabından ve sürücü raporundan AYNEN çekilir; KAPSAM satırlarını baş mimar yazdı (kural vermez, kararın metnini kâhinin diline bağlar).
# Ders 5: girdiye programın dosya adı, kod davranışı, sınama sayısı, programın ürettiği değer GİRMEZ (soru metinlerindeki 'program bugün' sözleri OKUMA KURALI ile etkisiz).
# Çağrı: cd <depo>; python3 -I <bu> <girdi çıktısı> <görev metni çıktısı> <taban dalı>
import sys
G_OUT, I_OUT, TABAN = sys.argv[1], sys.argv[2], sys.argv[3]
SP = '/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad'
t = open('docs/2.5.0-IS-LISTESI.md', encoding='utf-8').read()
il = t.split('\n')
D = t[t.find('\n## D'):]
dent = D.split('\n- ')[1:]
kk = open('docs/erp/MUHASEBELESTIRME-KURAL-KITABI.md', encoding='utf-8').read().split('\n')
ek1 = open('docs/erp/MUHASEBELESTIRME-KURAL-KITABI-EK-1.md', encoding='utf-8').read().split('\n')
sr = open('docs/devir/2.5.0-DEVAM/surucu3-rapor.md', encoding='utf-8').read().split('\n')

def tek(lines, basla):
    hit = [l for l in lines if l.startswith(basla)]
    assert len(hit) == 1, (basla, len(hit))
    return hit[0].strip()

def blok(basla):
    h = [i for i, l in enumerate(il) if l.startswith(basla)]; assert len(h) == 1, (basla, len(h))
    s = h[0]; e = s + 1
    while e < len(il) and il[e].startswith('  '): e += 1
    return ' '.join(x.strip() for x in il[s:e])

def soru(n):
    return tek(il, f'  S{n} (')

def dkayit(onek):
    x = [e for e in dent if e.startswith(onek)]
    assert len(x) == 1, (onek, len(x))
    return x[0]

def kes(metin, bas, son):
    i = metin.find(bas); assert i >= 0, bas
    j = metin.find(son, i); assert j >= 0, son
    return metin[i:j + len(son)].strip()

KITAP = [tek(kk, '| KG-2 K |'), tek(kk, '| KG-3 K |'), tek(kk, '| KG-4 K |'), tek(kk, '| KG-7 K |'), tek(kk, '| KG-8 |'),
         tek(kk, '| KG-24 |'), tek(kk, '| F-06 |'), tek(kk, '| F-08 |'), tek(ek1, '| M14 |')]
HEPSI_A = blok('- KULLANICI KARARI (05.11 17:16 UTC')
YEDI_A = blok('- KULLANICI KARARLARI 05.11 (21:30 UTC')
EK1_S = blok('- KULLANICI KARARLARI 05.11 ~18:55')
S49 = tek(il, '  S49 = A')
SINIF = tek(il, '  (2) carisiz Kasa girişi 649')
d0631 = dkayit('KULLANICI 14.11 06:31 UTC').strip()
e0435 = dkayit('BAŞ MİMAR KARARI 19.11 04:35')
e0507 = dkayit('BAŞ MİMAR KARARI 19.11 05:07')
e0929 = dkayit('BAŞ MİMAR KARARI 19.11 09:29')
e1554 = dkayit('BAŞ MİMAR KARARI 19.11 15:54')
B6 = kes(e0435, 'Bunun yerine KDV mahsubu', '(geri alınabilir).')
B8 = kes(e0507, 'bu ÜÇ kuralın yeni yönü', 'tek tanım).')
B8b = kes(e0507, 'B-6 BUNUNLA BİRLEŞİR:', 'yeni yöne geçer).')
B8c = kes(e0507, 'KG-2, KG-24 ve .90 alt hesapları', 'eskisi gibi düzeltilir.')
B8d = kes(e0507, 'BİLİNEN SINIR (teslim notuna):', 'eski yönde kalır.')
B11 = kes(e0929, '(B-11) = A —', 'ekran / PDF / Excel toplamı aynı.')
B11g = kes(e1554, '(1) B-11 GÜN YORUMU = A —', "BİLİNEN SINIRLAR'ına.")
q = {n: soru(n) for n in [120, 155, 189, 190, 192, 197, 198]}
K0 = [l.strip() for l in sr if l.startswith('- **s78')]
assert len(K0) == 1, len(K0)
K0.append("- **s104:** senaryoda formdaki peşin ödeme (P2) Kasa açılışından SONRA sıralanmış; peşin ödeme faturayla aynı anda girildiğinden bu sıra senaryonun kurabileceği bir sıra değil (şüphe; R8).")
# s108 / s42 / s51: sürücü satırları programın ürettiği değerleri taşıyor (ders 5) — baş mimar programın değeri OLMADAN yeniden yazdı; dayanaklar aynen.
K = K0 + [
    "- **s108:** kâhin taksit kartı tahsilatını S155 sınırına sokmuyor (şüphe). Dayanak: S155 = A, \"tek kural, bütün kayıt türlerinde (tahsilat, …) aynı\".",
    "- **s42:** S192 = A'ya göre kâhinin M13 ile tek kuyruğun ayrıştığı yerde susması gerekiyordu; açık fatura raporunda (fatura başına kalan) susmuyor (şüphe; iki faturalı cari, toplam aynı).",
    "- **s51:** muhasebe kâhini S120 = A'yı kurmamış (\"yalnız ELLE borçları eskiden yeniye içine alır\") — gecikmiş tutarın ölçüsü bundan etkileniyor (şüphe; bakiye aynı).",
]
# s93: programın değeri değil, ESKİ SÜRÜMÜN gerçek kodunun çıktısı (KANIT KURALI 2 — kâhin kaynağı); cümle baş mimarca kısaltıldı.
S93 = ("- **s93 (B14) — kâhinin 2.4.9 modeli gerçek v2.4.9 koduyla tutmuyor (şüphe):** sürücünün GERÇEK v2.4.9 koşusu (eski sürümün kodu — kâhinin izinli fark kaynağı), "
       "şüpheli caride faturaya bağlı çek tahsilatını B 101 / A 128 yazıyor; kâhinin 2.4.9 modeli (README K3 '120'de kalanlar: … Kapatılacak Fatura bağlı tahsilat') 120 diyor; "
       "kâhinin README'si '2.4.9'un gerçek eşleşmesi DOĞRULANMADI' diyor.")

g = []; w = g.append
w("# Muhasebe kâhini bakımı 13 + defter kâhini bakımı 4 — karar girdisi (ana oturum yazdı; TEK girdi kaynağın)")
w("")
w("Bu dosya, muhasebe kâhininin bakım 12'sinden ve defter kâhininin bakım 3'ünden sonra çıkan, iki kâhine dokunan kararları taşır: Ç7b paketinin (kitabın FATURA / KDV / KAYIT türetme")
w("kuralları; kural geçiş günü; alış faturasında KDV İndirim Dönemi), kâhin bakımı 12'nin ve sürücü bakımı 3'ün sorularının yanıtları ve sürücünün 'kâhin şüphesi' listesi.")
w("OKUMA KURALI: soru metinlerinde geçen 'program bugün', 'koşuldu', 'tur …', 'test', 'mutant', 'kod değişmez' sözleri ve oradaki sayılar KURAL KAYNAĞI DEĞİLDİR — kural yalnız KARAR")
w("satırlarıdır (seçilen seçeneğin metni), kitap satırlarıdır ve aşağıdaki KAPSAM satırlarıdır. Kararın söylemediği alt durumda kural UYDURULMAZ: o alanda SUS ve raporun 'KULLANICIYA")
w("SORULMALI' listesine yaz (ders 40, 43). Etiketler: 'KULLANICI KARARI' (kullanıcının seçimi), 'KULLANICI KURALIYLA ÖNERİ UYGULANDI' (kullanıcının 14.11 06:31 'önerileri uygula' kuralıyla")
w("öneri seçildi — kullanıcı değiştirebilir), 'BAŞ MİMAR KARARI' / 'BAŞ MİMAR YORUMU' (kullanıcıya gösterildi; aynı etiketle yaz). Kullanıcının 06:31 kuralı (AYNEN):")
w(d0631)
w("")
w("## A. MUHASEBE KÂHİNİ (`test/bagimsiz/muhasebe/`)")
w("")
w("### A1. Kitabın FATURA / KDV / KAYIT türetme kuralları (KG-2, KG-3, KG-4, KG-8, KG-24, F-06, F-08, M14)")
w("KİTAP SATIRLARI (AYNEN; sütunlar: kimlik | olay | bugün / tarih | seçenek A | seçenek B | karar …):")
for x in KITAP: w(x)
w("KULLANICI KARARLARI (AYNEN):")
w(HEPSI_A); w(YEDI_A); w(EK1_S); w(S49)
w("SINIFLAMA SORUSU (AYNEN): " + SINIF)
w("BAŞ MİMAR KARARI 19.11 (sınıflama — para kuralı değil; tutar ve Gelir Tablosu kalemi aynı, yalnız alt hesap; kullanıcıya gösterildi, değiştirebilir): carisiz Kasa girişi 649.90 "
  "'Sınıflandırılmamış' alt hesabına yazılır (kitabın G-8 / §7.5 (6) düzeni; S49 = A'nın carisiz evrakı da 649.90 — aynı olayın iki yolu aynı hesapta).")
w("KAPSAM (baş mimar): kâhinin seçim tablosu bu satırların kararlı sütununu zaten modelliyorsa yeni kural YAZMA — her kural için en az bir senaryoyla (satış iadesi + alış iadesi + "
  "ayın KDV mahsubu; kayıt tahsilatı; belgesiz satış; ihracat istisnalı satış; gider türleri; carisiz Kasa girişi) beklenenin kitapla aynı olduğunu göster. Modellemediği / farklı "
  "modellediği kuralda kitabın kararlı sütununu kur, eski → yeni beklentiyi G3'te yaz. Bir alan kâhinin dilinde yoksa (ör. gider türü, istisna kodu) SUS + DENENMEYEN + 'SÜRÜCÜ İÇİN'.")
w("")
w("### A2. Kural geçiş günü — kilitli eski veride üç kuralın eski yönü (B-8 + B-6; KULLANICI KURALIYLA ÖNERİ UYGULANDI, BAŞ MİMAR KARARI 19.11)")
w("KARAR (AYNEN; 19.11 05:07): " + B8)
w("KARAR (AYNEN; 19.11 05:07): " + B8b)
w("KARAR (AYNEN; 19.11 04:35 — B-6'nın KDV mahsubu kolu): " + B6)
w("KARAR (AYNEN; 19.11 05:07): " + B8c)
w("KARAR (AYNEN; 19.11 05:07): " + B8d)
w("KAPSAM (baş mimar): 'üç kural' = KG-3 (kayıt / carisiz tahsilatın karşılığı), KG-8 (satıştan iade KDV'si) ve F-08 (alıştan iade KDV'si). 'ESKİ yön' = kitap satırının 'bugün' "
  "sütunu (KG-3'te kayıt tahsilatının eski karşılığı; KG-8 / F-08'de iade KDV'sinin eski hesabı — kitabın KG-8 B sütunu) — yorumda hangi sütunu okuduğunu yaz. 'Geçiş günü' = "
  "programın bu sürüme güncellendiği andaki kilit tarihi; güncellemede kilit yoksa geçiş YOK, bütün kayıtlar yeni yön. Kilit sonradan açılıp kapansa da geçiş günü değişmez. "
  "KDV mahsubu kolu: güncellemeden ÖNCE yazılmış (ters kaydedilmemiş) mahsubun ayında iade KDV'si eski yönde; mahsup ters kaydedilip yeniden yazılırsa o ay yeni yönde. KG-2, KG-24 "
  "ve .90 alt hesaplarında geçiş YOK (kilitli dönemde kural farkı + düzeltme fişi — kâhinin KG-15 / M7 düzeni). Kâhinin dili 'eski sürümde kilitlenmiş veri + güncelleme' sırasını "
  "kuruyorsa (2.4.9 modeli) kur; kuramıyorsa SUS + DENENMEYEN; yeni olay türü gerekiyorsa EKLEME — 'SÜRÜCÜ İÇİN' satırı yaz.")
w("")
w("### A3. KG-7 = A — alış faturasında 'KDV İndirim Dönemi' (KULLANICI KARARI 05.11 'hepsi A'; KDV Özeti dönemi BAŞ MİMAR KARARI 19.11)")
w("KİTAP SATIRI: yukarıda A1'deki KG-7 K satırı (AYNEN).")
w("KARAR (AYNEN; 19.11 09:29): " + B11)
w("KARAR (AYNEN; 19.11 15:54): " + B11g)
w("KAPSAM (baş mimar): alış faturasının 191'i, faturanın 'KDV İndirim Dönemi' ayının KDV mahsubuna girer (dönem boşsa / verilmemişse belge ayı); dönem belge ayından ÖNCE olamaz, "
  "en geç kitabın satırındaki sınır (izleyen yıl sonu). Yevmiyede alış maddesinin TARİHİ belge tarihidir (191 o gün borçlanır) — yalnız hangi ayın mahsubunun kapattığı değişir; "
  "bunu kitabın satırından doğrula, ayrışırsa SUS + KULLANICIYA SORULMALI. Kâhinin dilinde alış faturasına İSTEĞE BAĞLI bir 'KDV İndirim Dönemi' (YYYY-AA) alanı EKLENEBİLİR "
  "(bu bakımın tek izinli dil eki — yoksa kural sınanamaz; alan verilmeyen bütün eski senaryolar aynen kalmalı, G3'te BEKLENMEYEN 0); alanın adını ve anlamını 'SÜRÜCÜ İÇİN'de yaz "
  "(sürücüyü ana oturum eşler). Senaryolar: Aralık belge tarihli, dönemi Ocak'a alınmış alış faturası (Aralık ve Ocak mahsubu, 191 her ay sonu; eksi YOK); dönem = belge ayı; kilitli "
  "Aralık + açık Ocak. KDV Özeti raporu kâhinin çıktısında yoksa B-11 / gün yorumu için SUS + DENENMEYEN.")
w("")
w("### A4. K-14 / K-15 sınırının iki alt durumu (S189 = A, S190 = A; KULLANICI KURALIYLA ÖNERİ UYGULANDI 14.11 13:12)")
w("SORU + KARAR S189 (AYNEN):"); w(q[189])
w("SORU + KARAR S190 (AYNEN):"); w(q[190])
w("KAPSAM: bakım 12'de bu iki alanda SUSULDU; şimdi kur: hesabın açılışıyla AYNI gün olan hesapsız hareket sınırın İÇİNDEDİR (519'a gitmez); silinmiş hesabın açılış tarihi 'en geç "
  "açılış'a SAYILMAZ. Dil 'hesap silme'yi kuramıyorsa S190 kolu DENENMEYEN.")
w("")
w("### A5. S168 = B'nin örneği ↔ kâhinin kuyruk modeli (S192 = A; KULLANICI KURALIYLA ÖNERİ UYGULANDI 14.11 13:12)")
w("SORU + KARAR S192 (AYNEN):"); w(q[192])
w("KAPSAM (baş mimar; dayanak S192 = A'nın metni 'kararın kendi örneği geçerli (tek kuyruk)'): kâhinin M13 okuması (şüpheliye almada açık borçlar vade sırasıyla) S168 = B'nin "
  "örneğine HİZALANIR — örnekte kabul ve 128 = 700. Bakım 12'de iki görünümün ayrıştığı yerde kurulan SUS kalkar; ancak kararın örneğinden çıkmayan alt durumlarda (şüpheliye "
  "almadan sonra kesilip vadesi erken fatura; 'Şüpheliden Çıkar' ile dönen fatura) tek kuyruğun ne dediği kâhinin kendi kitabından kurulamıyorsa SUS sürer + KULLANICIYA SORULMALI.")
w("")
w("### A6. Kural Farkı Düzeltme Fişi ters kaydı ve Açılış Eşleştirme (S197 = B, S198 = A; KULLANICI KURALIYLA ÖNERİ UYGULANDI 19.11 06:41)")
w("SORU + KARAR S197 (AYNEN):"); w(q[197])
w("SORU + KARAR S198 (AYNEN):"); w(q[198])
w("KAPSAM: S197 = B — kilit yıl sonunu geçtikten sonra önceki yılın TEK Kural Farkı Düzeltme Fişi sonraki yılda ters kaydedilirse fark yeniden açılır ve 671'e yazılır (kararın "
  "örneği: 2027'de 500 = 0, 671 alacak 700); bakım 12'deki A okumasını bu kararla değiştir, eski → yeni beklentiyi G3'te yaz. S198 = A — 127 eşleştirmede hedef olamaz; kâhin "
  "senaryosu bunu carisiz Excel kartıyla kurar (dil kuramıyorsa DENENMEYEN).")
w("")
w("### A7. Sürücünün 'kâhin şüphesi' listesi (sürücü bakımı 3 raporundan; her biri kâhinin kendi kitap / karar dayanağıyla çözülür — ders 40)")
w(S93)
for x in K: w(x)
w("İLGİLİ KARARLAR (AYNEN):"); w(q[155]); w(q[120])
w("KAPSAM (baş mimar): şüphe kanıt değildir; her maddede kâhinin kendi kural / karar okumasını yaz. s93: 2.4.9 modeli eski sürümün gerçek koduyla ayrışıyorsa model eski sürüme "
  "hizalanır (eski sürüm KÂHİN kaynağıdır — fark testi) ya da o alan SUS (gerekçeyle). s78 / s104: senaryo kararın yasakladığı bir giriş / sırayı kuruyorsa SENARYO düzeltilir "
  "(kural değişmez). s108: S155 = A 'bütün kayıt türlerinde' diyorsa taksit kartı tahsilatı da sınıra girer. s42: S192 = A'dan sonra (A5) kendiliğinden çözülüyorsa yaz. s51: S120 = "
  "A'yı kur (elle açılan kartın kapsadığı elle borçlar; faturalar kendi vadesiyle) ya da dil taşımıyorsa SUS + DENENMEYEN.")
w("")
w("## B. DEFTER KÂHİNİ (`test/bagimsiz/defter/`)")
w("")
w("### B1. İade KDV'si (KG-8 = A, F-08) ve kural geçiş günü (B-8 + B-6)")
w("KARARLAR: A1'deki KG-8 / F-08 kitap satırları ve 05.11 'hepsi A' kararı; A2'nin bütün KARAR satırları (AYNEN, yukarıda).")
w("BİLGİ (ana oturum): defter kâhini ↔ program karşılaştırmasında Ç7b'den beri yalnız şu dört anahtar ayrışıyor: mizan K_EYLUL 191, mizan K_EYLUL 391, mizan K_SON 191, mizan K_SON 391 "
  "(programın değerleri VERİLMEZ — ders 5). Kâhinin bu anahtarlardaki beklentisi iade KDV'sinin hangi yönüne dayanıyor, yorumda yaz.")
w("KAPSAM (baş mimar): defter kâhininin seçimi KG-8 / F-08'in kararlı sütunu (satıştan iade KDV'si B 191; alıştan iade KDV'si A 391; ayın mahsubu ikisini kitaba göre kapatır) değilse "
  "kararlı sütuna geçir; senaryonun verisi bu sürüme güncellemeden ÖNCE kilitlenmiş / mahsubu yazılmış ayları içeriyorsa A2'nin geçiş kuralını uygula; dil güncelleme anını "
  "kuramıyorsa bütün kayıtlar yeni yön (kilitsiz güncelleme — geçiş yok) diye kur ve bunu yorumda açıkça yaz. Beklenenler ELLE hesaplanır; eski → yeni G3'te.")
open(G_OUT, 'w', encoding='utf-8').write('\n'.join(g) + '\n')

p = []; w = p.append
w("Sen DestekOfis projesinde MUHASEBE KÂHİNİ BAKIMI 13 + DEFTER KÂHİNİ BAKIMI 4 ajanısın (2.5.0 — muhasebe kâhini `test/bagimsiz/muhasebe/`, defter kâhini `test/bagimsiz/defter/`). PROGRAMIN KODUNU GÖRMEZSİN (ders 5, 40). KENDİ dalında commit edersin; PUSH YAPMAZSIN. Yanıtın Türkçe. Eforun high. Bu bir TOPLU KÂHİN BAKIMIDIR: Ç7b paketinin (kitabın fatura / KDV / kayıt türetme kuralları, kural geçiş günü, KDV İndirim Dönemi) iki kâhine dokunan kararları + önceki bakımların ve sürücünün açık soruları TEK bakımda işlenir. HER BİTMİŞ ADIM HEMEN COMMIT (kapsayıcı yeniden başlarsa commit'siz iş kaybolur).")
w("")
w("## Girdi")
w(f"Tek karar kaynağın: `{SP}/kahin-muh13-kararlar.md` (TAMAMINI oku; A1–A7 muhasebe kâhini, B1 defter kâhini). Dosyanın başındaki OKUMA KURALI bağlayıcıdır.")
w("")
w("## Hazırlık")
w(f"1. Worktree'de (dalında kendi commit'in YOKKEN) `git reset --hard {TABAN}` (yerel taban dalı; worktree master'dan açılmış olabilir — birleşim DEĞİL sıfırlama). `git log --oneline -3 -- test/bagimsiz/muhasebe test/bagimsiz/defter` ile muhasebe kâhini bakımı 12'nin (kanıt commit'i c2d503a8) dalında olduğunu doğrula; değilse DUR ve raporla. `ln -s /home/user/ofis---y-netimi/node_modules node_modules` (`npm ci` YOK).")
w("2. ÖNCE oku: `CLAUDE.md` (dersler 1–54; özellikle 5, 6, 7, 31, 38, 40, 43, 54); `docs/BAGIMSIZ-DOGRULAMA-PRENSIBI.md`; girdi dosyası; `test/bagimsiz/muhasebe/README.md` içinde 'Kaynaklar', 'Dosyalar', 'Senaryo dili', 'Model kapsamı', seçim tablosu, 'Değişmezler', 'KARAR GEREKİYOR', 'DENENMEYEN / BİLİNEN SINIRLAR' ve bakım 11 + 12 bölümlerinin TAMAMI, ayrıca KG-2, KG-3, KG-4, KG-7, KG-8, KG-15 / M7, KG-24, F-06, F-08, M13, M14, K-14, K-15, 2.4.9 modeli (K3) geçen bölümler; kural kitabı dosyalarından (`docs/erp/MUHASEBELESTIRME-KURAL-KITABI.md` ve EK-1 / EK-2 / EK-2B) yalnız bu satırlar ve ilgili bölümleri; `test/bagimsiz/defter/KARARLAR.md` TAMAMI. Önceki kararlar YALNIZ kâhinlerin kendi README / KARARLAR.md'sinden okunur. Büyük dosyalarda tam okuma yerine başlık + arama (bağlamını boşa harcama).")
w("")
w("## Yasaklar (bağımsızlık)")
w("- `server/`, `client/`, `bulut/`, `packaging/`, `tools/` (kanit.mjs yalnız çalıştırılır), `docs/devir/**`, `docs/2.5.0-IS-LISTESI*.md` (HER sürümü — eski commit'teki hâli dahil), `docs/erp/` altında muhasebe kâhininin kendi 'Kaynaklar' listesinde OLMAYAN her dosya (özellikle tasarım notları C2…, C3…, C5…, C7A…, C7B…, BIRLESIK…), `test/bagimsiz/muhasebe-surucu/` (sürücü — programı koşar; OKUNMAZ, KOŞULMAZ), `test/bagimsiz/cari/`, `test/` altında `test/bagimsiz/muhasebe` + `test/bagimsiz/defter` dışındaki her şey OKUNMAZ. Defter kâhininin `kos.mjs` / `karsilastir.mjs`'i programı koşar: yalnız olay / alan EŞLEMESİ için okunabilir, KOŞULMAZ, DEĞİŞTİRİLMEZ (`npm run test:kahin-defter`'i ana oturum koşar).")
w("- `docs/kanit/` altında başka ajanların dosyaları ve git farkı / geçmiş içeriği açılmaz (kendi önceki bakım araçların HARİÇ — `docs/kanit/2026-11-14/kahinmuh12-arac/`; uyarlayıp `docs/kanit/2026-11-19/kahinmuh13-arac/` altına kopyala). Program KOŞULMAZ. CLAUDE.md'nin 'Açık iş' bölümünde programın durumu hakkında gördüğün hiçbir şey kural / beklenti kaynağı DEĞİLDİR.")
w("")
w("## İş")
w("1. ÖNCE YORUM (ders 40): muhasebe README'ye 'Kâhin bakımı 13' ve defter KARARLAR.md'ye '2.5.0 Ç5 bakımı 4' bölümü — girdinin her maddesi için kural başına yorum (hangi kural değişir, hangi alan SUS'a döner / SUS'tan çıkar, hangi beklenen değişir, kararın / kitabın hangi sözüne dayanır), etiketler girdideki gibi. AYRI commit.")
w("2. Modele / senaryolara işle (girdinin KAPSAM satırlarıyla): A1 kitap kuralları (zaten modelliyse yalnız senaryo); A2 geçiş günü (dil kuramıyorsa DENENMEYEN); A3 KG-7 (alış faturasına İSTEĞE BAĞLI 'KDV İndirim Dönemi' alanı — bu bakımın TEK izinli dil eki); A4 S189 / S190; A5 S192 hizalaması; A6 S197 / S198; A7 şüpheler (her biri kâhinin kendi okumasıyla); B1 defter kâhini. Her yeni / değişen elle senaryoda beklenenler ELLE hesaplanır, hesap yorumda.")
w("3. A3'teki alan dışında olay dilini değiştirmen GEREKİRSE (yeni alan / yeni olay türü) YAPMA — SUS + DENENMEYEN + raporda 'SÜRÜCÜ İÇİN' satırı. Var olan alanların anlamı değişiyorsa 'SÜRÜCÜ İÇİN'de alan alan yaz (sürücüyü ana oturum eşler).")
w("4. Mutantlar: her yeni / değişen kural için en az bir mutant (ör. 'satıştan iade KDV'si 391'de', 'alıştan iade KDV'si 191'de', 'kayıt tahsilatı gelire', 'geçiş günü yok sayılır — eski kilitli kayıtlar da yeni yön', 'mahsubu yazılmış ay yeni yöne', 'KDV İndirim Dönemi yok sayılır — hep belge ayı', 'dönem belge ayından önce kabul', 'aynı gün açılış 519', 'silinen hesap en geç açılışa sayılır', 'S192: M13 vade sırası', 'S197: ters kayıtta fark açılmaz'); bakım 1–12 mutantları hâlâ yakalanıyor mu (yaşayan mutant adıyla; beklenen bedelse gerekçesiyle). Defter kâhininde `oz-test.py`'nin mutantlarıyla aynı düzende.")
w("5. G3: muhasebe kâhininde bakım 12'ye, defter kâhininde bakım 3'e göre değişen / yeni / kalkan beklenenler senaryo senaryo (kendi önceki düzeninle); girdinin maddelerinin alanları DIŞINDA BEKLENMEYEN 0 olmalı. SUS'a dönen / SUS'tan çıkan her anahtar adıyla ve maddesiyle.")
w("6. TOPLU SORULAR: kararların söylemediği HER alt durumu raporun 'KULLANICIYA SORULMALI' bölümünde TEK listede ver (durum, en küçük örnek, iki okuma, her okumada bakiye; çok uç durumsa üçüncü seçenek 'Uç durum böyle kalsın (BİLİNEN SINIR)'); o alanlarda SUS. Önceki bakımlarda sorulanları YİNELEME.")
w("")
w("## Yöntem")
w(f"- Eski kâhin kopyası değişiklikten ÖNCE: `git archive HEAD test/bagimsiz/muhasebe test/bagimsiz/defter | tar -x -C {SP}/kahinmuh13-<kısa>/` (benzersiz klasör — ders 25); yeni senaryolar eski modelde BEKLENEN NEDENLE kırmızı (ders 7, 38) — iletisi okunur.")
w(f"- Kâhinlerin kendi testleri iki TZ (UTC, Europe/Istanbul): `KANIT_DIR=<kendi not defteri klasörün> node tools/kanit.mjs kos kahinmuh13-<ad> -- python3 -I -B <dosya>` (muhasebe: test_model.py, mutasyon.py; defter: oz-test.py); mutasyon ve geniş tarama `flock -s -w 3600 {SP}/olcum.lock` ile (TEK SEFERLİK bekleme; döngü YOK; zamanlanmış görev / hatırlatıcı KURMA); HER arka plan koşusu AÇIK SÜRE SINIRIYLA (`timeout -k 5 <sn> …`), uzun koşu baştan 2 saat sınırla; kanıt `docs/kanit/2026-11-19/kahinmuh13-*`.")
w("- Yük okuması ile koşu başlatma AYNI adımda gönderilmez: önce `cat /proc/loadavg`; yük > 4 ise koşu BAŞLATMA, tek seferlik bekleme komutuyla bekle (ör. `timeout 600 bash -c 'until [ \"$(cut -d\" \" -f1 /proc/loadavg | cut -d. -f1)\" -lt 4 ]; do sleep 20; done'`), sonra yükü yeniden oku. Bakım, kanıt koşuları (iki saat dilimi) yapılmadan BİTMİŞ sayılmaz. Disk 5 GB'ın altına düşürülmez (`df -h /`).")
w("- Test / araç koşusuna `GIT_DIR` / `GIT_WORK_TREE` VERME (ders 54); her koşudan sonra `git status -sb` + son commit oku.")
w("- Kendi arka plan işin sürerken turunu rapor vermeden BİTİRME; sonucu bekle, sonra raporla. /tmp üzerinde boyut ölçme / tarama komutu koşma. `pkill` / joker `rm` YOK. Commit'e yalnız kendi yolların (ders 44).")
w("- Commit iletisi sonunda tam olarak şu iki satır (model adı YOK):")
w("  ```")
w("  Co-Authored-By: Claude <noreply@anthropic.com>")
w("  Claude-Session: https://claude.ai/code/session_01EhegDvmPQ9hx2ibfitm6og")
w("  ```")
w("")
w("## Rapor")
w("Madde madde yorum (A1–A7, B1); SUS'a dönen / SUS'tan çıkan anahtarların TAM listesi (kâhin + senaryo + anahtar + madde); yeni / değişen elle senaryolar ve değerleri; SÜRÜCÜ İÇİN (A3 alanı ve anlamı değişen her şey; değişmediyse 'değişmedi'); mutantlar (yeni + eski yaşayan); test sayıları (iki TZ, çıkış kodlarıyla; eski modelde kırmızı + nedenleri); G3 dökümü; KULLANICIYA SORULMALI; DENENMEYEN; ana oturumun yeniden koşacağı komutlar; OKUNAN DOSYALARIN TAM LİSTESİ (satır aralıklarıyla); dal ucu commit'i.")
open(I_OUT, 'w', encoding='utf-8').write('\n'.join(p) + '\n')
print(len('\n'.join(g)), len('\n'.join(p)))
