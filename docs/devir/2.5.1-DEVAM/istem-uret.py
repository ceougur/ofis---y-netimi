# 2.5.1 ilk dalga görev metinleri (27.11.2026). Çalıştır: python3 -I docs/devir/2.5.1-DEVAM/istem-uret.py
# Ortak bölümler tek yerde; her ajanın kendi işi ayrı. Çıktı: docs/devir/2.5.1-DEVAM/<ad>-istem.txt
import os

SP = "/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad"
ANA = "/home/user/ofis---y-netimi"
TABAN = "t251-taban"

KURALLAR_KULLANICI = """KULLANICI KURALI — ÖNERİYİ UYGULA (14.11, AYNEN: "bana sorun varsa önerilerini uygula"): soru öneriyle yazılır; para / kapama / "kime kaç kez" kuralı dışındaki sorularda öneri uygulanır. Para / kapama / defter kuralı ayrışması KODLANMAZ, sorulur (ders 43).
KULLANICI KURALI — SORU DÜZENİ (06.11, AYNEN: "bana soru sorduğunda eğer çok uç durumsa konu; seçeneklere uç durum böyle kalmasında sorun yok maddesi de ekle"): uç / seyrek durumda üçüncü seçenek 'Uç durum böyle kalsın (BİLİNEN SINIR)'.
KULLANICI KURALI — DÖNGÜYE GİRME (20.11, AYNEN: "yapılan işlerde döngüye girmeyelim detaylara boğulup, programı yada kullanıcıyı etkileyemem hususları 2.5.1 sürümüne bırakalım"): programın davranışını, sayılarını, hızını ya da kullanıcının gördüğünü DEĞİŞTİRMEYEN her husus (test düzeni, araç, ölçüm nüansı, doğrulanmamış kuşku, sayıları doğru görünüm ayrıntısı) KOVALANMAZ; raporun 'SONRAKİ SÜRÜME' başlığına yazılır. Kalite kapıları AYNEN.
KULLANICI KURALI — REFERANS PROGRAMLAR (12.11): yaygın muhasebe programları referans alınabilir; bir programın davranışı ancak belgesi / ekranı okunmuşsa dayanak yazılır, hafızadan 'şu program böyle yapar' denmez."""

def hazirlik(kod=True, taban=None, taban_ne="2.5.1 başlangıç commit'i"):
    taban = taban or TABAN
    s = f"""## Hazırlık
1. Kendi ağacında (kendi commit'in YOKKEN) `git reset --hard {taban}`; `git log --oneline -1` ile doğrula (etiket {taban} = {taban_ne}); değilse DUR ve bildir. `ln -s {ANA}/node_modules node_modules` (`npm ci` YOK). Tarayıcı gerekiyorsa `PLAYWRIGHT_BROWSERS_PATH={SP}/pw-1194` (`playwright install` YOK).
2. ÖNCE oku: `CLAUDE.md` (anayasa, test kuralı, dersler 1–55, yazım düzeni, kalıcı ürün kararları), `docs/BAGIMSIZ-DOGRULAMA-PRENSIBI.md`, `docs/devir/2.5.1-PLAN-TASLAK.md` (yalnız kendi işinin bölümü)."""
    if kod:
        s += " Kâhin MODEL dosyaları OKUNMAZ, `test/bagimsiz/**` YAZILMAZ."
    return s

def kurallar(ad, kod=True, taban=None):
    TABAN = taban or globals()["TABAN"]
    s = f"""## Ortak kurallar
- Yanıtın ve raporun TÜRKÇE. PUSH YOK (ana oturum birleştirir). Her bitmiş adımı (kod + testi + kanıtı) HEMEN commit et; commit'e yalnız kendi yolların (`git add <yol>`; `-A` / `-u` / `commit -a` YOK — ders 44). Zamanlanmış görev KURMA. Kendi arka plan işin sürerken rapor vermeden BİTİRME; bekleme için boş döngü kurma.
- GIT_DIR / GIT_WORK_TREE VERME (ders 54). `pkill` / `killall` / joker `rm` YOK; yalnız kendi oluşturduğun TAM yol silinir (ders 36). Disk 5 GB'ın altına düşmez (`df -h /`).
- Para / kapama / defter kuralı ayrışması ya da kararların söylemediği durum çıkarsa KODLAMA — raporda 'KULLANICIYA SORULMALI' (iki seçenek + öneri + her okumada hangi sayı ne olur; uç durumsa üçüncü seçenek). Mimari seçimse 'BAŞ MİMAR KARARI GEREKİYOR'.
- Rapor taslağını adım adım `docs/devir/2.5.1-DEVAM/{ad}-rapor.md`'ye yaz ve commit et; SON İLETİN bu raporun kendisidir.
- Commit iletisi sonunda TAM olarak şu iki satır (model adı HİÇBİR yerde yazılmaz — kod, yorum, commit, belge):
  Co-Authored-By: Claude <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01EhegDvmPQ9hx2ibfitm6og"""
    if kod:
        s += f"""
- Her yeni test: eski kodda (taban; AYRI kopya — `git worktree add --detach /dev/shm/{ad}-<kısa>/eski {TABAN}`; ders 23, 25, 51) BEKLENEN NEDENLE kırmızı (iletisi okunur — ders 7, 38), yeni kodda yeşil; iki saat diliminde (TZ=UTC ve TZ=Europe/Istanbul); göreli tarih + sahte saat (ders 13). Sayılar VERİ TABANINDAN / yanıt gövdesinden okunur (ders 3, 12). Eski kopyaya yalnız YENİ test dosyaları girer.
- Koşular `HUKUK_LICENSE_URL=http://127.0.0.1:9 KANIT_DIR=<kendi not defteri klasörün> node tools/kanit.mjs kos {ad}-<ad> -- <komut>`; BÜTÜN test koşuların `flock -s -w 3600 {SP}/olcum.lock` altında (tek seferlik bekleme); her arka plan koşusu `timeout -k 5 <sn>` (en çok 2 saat; toplam sürenin 1,5 katından kısa olmasın — ders 55); önce `cat /proc/loadavg`, 4'ün üstündeyse tek seferlik bekle. Tam `npm test` YOK (ana oturum koşar); yalnız değişen alanın testleri + KOMŞULAR (`git grep` taramasıyla — ders 10).
- Kanıt (ham çıktılar) `docs/kanit/<bugünün tarihi>/{ad}-*` altında, ayrı 'Kanıt:' commit'iyle. Dosya adında Windows'ta açılmayan karakter olmaz (ders 33). Kaynak tarayan test `/\\r?\\n/` ile böler (ders 27).
- Dosyaya dokunan (silen / taşıyan / kilitleyen) her yeni test Windows'ta da geçecek biçimde yazılır (ders 48); Windows koşusu ana oturumda CI ile okunur.
- Kılavuza DOKUNMA (son adayda toplu güncellenir); kılavuz için önerdiğin kısa 'nasıl yapılır' metnini rapora yaz. `.github/**`, `package.json`, `tools/**`, göç dosyaları (migrations) YASAK — gerekiyorsa DUR, raporda 'BAŞ MİMAR KARARI GEREKİYOR'. Yeni ekran senaryosu açabilirsin; ci.yml'ye EKLEME — raporda 'CI listesine eklenecek'.
- Kullanıcıya görünen adlar YAZIM DÜZENİ'ne uyar (pencere / düğme / sütun / seçenek adlarında her sözcüğün ilk harfi büyük; cümleler cümle düzeninde); ekran = PDF = Excel; raporda alt TOPLAM satırı."""
    return s

def rapor(kod=True):
    if kod:
        return """## Rapor (son iletin; Türkçe)
EN BAŞTA değişen her gözlenebilir davranış (önce → sonra; ekran adıyla, örnek sayılarla); değişen dosyalar; TARAMA tablosu; yeni / değişen testlerin kırmızı nedeni + yeşili (iki TZ); kabul koşullarının sayıları; mutant tablosu; hız tablosu (varsa); KULLANICIYA SORULMALI; BAŞ MİMAR KARARI GEREKİYOR; SONRAKİ SÜRÜME; DOĞRULANMADI; DENENMEYEN; 'CI listesine eklenecek'; kılavuz metni önerisi; commit listesi; dal ucu; ana oturumun yeniden koşacağı komutlar."""
    return """## Rapor (son iletin; Türkçe)
EN BAŞTA üç-beş cümlelik sonuç; yazdığın belgelerin yolları; KULLANICIYA SORULMALI (numaralı); BAŞ MİMAR KARARI GEREKİYOR; planın eskiyen yerleri; önerilen paketleme ve sıra; kâhin bakımına girdi listesi; DOĞRULANMADI; commit listesi; dal ucu."""

# ---------------------------------------------------------------- P-D
PD = f"""Sen DestekOfis projesinde 2.5.1'in DEVİR PLAN OKUMASI + D3 / D4 TASARIM ajanısın (P-D; eforun high). KOD VE TEST YAZMAZSIN — yalnız belge. Amaç: 2.5.0'da ertelenen devir işinin (D3–D6) kodu başlamadan önce planı BUGÜNKÜ koda karşı yeniden okumak, D3 ve D4'ün tasarım notunu yazmak ve kullanıcıya sorulması gereken para / kapama kuralı sorularını çıkarmak. Yayın hedefi: müşterilerin 1 Şubat 2027 sınırından önce.

{hazirlik(kod=False)}
3. Sonra oku: `docs/devir/DEVIR-PLANI.md` (G bölümü öbür bölümlerle çelişirse GEÇERLİ; G13 açık sorular, G14 mali müşavir sonuçları), `docs/devir/D2-ALTYAPI-TASARIM.md` (özellikle §12 'D3–D6 için girdiler' — D2'nin bıraktığı sözleşme), `docs/erp/MUHASEBE-CEKIRDEGI-PLANI.md` §13–§14, `docs/erp/MUHASEBELESTIRME-KURAL-KITABI.md` + ekleri (kapanış / açılış / devir bölümleri), tasarım notları `docs/erp/C2-FIS-DEFTERI-TASARIM.md`, `C3-DONDURMA-TASARIM.md`, `C5-ACILIS-TASARIM.md`, `C5B-TYK-TASARIM.md`, `C6-HESAP-TASARIM.md` (yalnız devire dokunan bölümler). KOD: `server/lib/devir/**`, `server/routes/devir.mjs`, saklanan fiş defteri, dondurma, açılış, tek borç sırası, mali tablo hesabı, şirket / yedek / arşiv katmanı, şema (göçler). Kâhin README'lerinin yalnız 'güncel kurallar dizini' okunabilir (devir bölümleri); kâhin MODEL kodu okunmaz.
4. Kararları ARAMADAN soru yazma: `docs/2.5.0-IS-LISTESI.md` C / D (uzun satırlı — python ile satır satır oku, düzenli ifadeli grep takılır) ve kural kitabında yanıt var mı önce bak.

## Kararlar (AYNEN)
KULLANICI 21.11 21:32 UTC (AYNEN: "haftalık limit devir için kalan adımlara yetmeyecek. D3 den D6 ya kadar olan kısmı 2.5.1 sürümüne bırakalım."): D3 (saf hesap + Devir Raporu), D4 (budama + açılışlar, arşiv, yazma yasağı, kilit izi), D5 (sihirbaz + arşiv görünümü + Geri Al + kılavuz), D6 (mutasyon, bağımsız gözden geçirme, dar kontrol, Uzun Doğrulama, elle kabul) 2.5.1'de.
KULLANICI 10.11 (AYNEN: "müşterilerle konuştum devir işleri 1 şubata kadar esnetiyorlar, süre ksıtımız yok").
PLAN KARARLARI: DEVIR-PLANI §0, §11, G0 (Devri Yenile VAR; açılışların karşılığı geçici 'Eşleştirilecek Açılış Bakiyeleri'; kapanış 7/A'yı da kapatır; AYRI AÇIK KALEM; kapanış / açılış fişleri saklanan fiş defterine, arşiv kilitlenir ve donar). KAPSAM DIŞI (plan §6 BİLİNEN SINIR): Devri Geri Al'ın kesim sonrası kayıtları taşıyarak geri alması; zincirleme Devri Yenile.
{KURALLAR_KULLANICI}

## İş (sırayla; her bölüm bitince commit)
1. PLAN ↔ KOD EŞLEMESİ (tablo): planın her adımı (G1–G10, §3–§7) bugünkü kodda neye dayanacak; 2.5.0'da değişen çekirdek (tek borç sırası, açılış düzeni, dondurma, saklanan fiş, KDV indirim dönemi, Defter Türü, WhatsApp saklama süresi, şema kapısı) planı NEREDE eskitti. Her satır kod yeriyle (dosya:satır).
2. TABLO SINIFLAMASI (G3): bugünkü şemadaki HER tablo için sınıf (arşivde kalır / yeni yıla açılışla taşınır / kesim sonrası satırları taşınır / ortak katman / budanır / dokunulmaz). Şemadan tara; planın listesinde olmayan tablo = AÇIK, adıyla.
3. D3 TASARIMI (saf hesap + Devir Raporu): modülün girdisi / çıktısı; ön izleme sayılarının tanımı (cari, açık fatura, taksit kartı, çek / senet, banka hesabı, stok kalemi, taşınacak hareket sayısı); Devir Raporu'nun satırları (kapanış = açılış, hesap hesap ve modül modül, kuruşu kuruşuna); AYRI AÇIK KALEM'in (G2) tek borç sırasından nasıl üretileceği; kapanış fişi (7/A, 690 → 691 → 692 → 590 / 591 — kapanış fişinde 691, 690'a DEĞİL 692'ye kapanır) ve açılış fişi (geçici hesabın arşivin kapanış bilançosuyla eşleşmesi); stok (ağırlıklı ortalama), çek / senet, banka, POS'un bekleyenleri, taksit kartları; arşiv kendi Defter Türü'nü taşır; işin arka planda koşması; HACİM BÜTÇESİ (G9: 100 bin satırda ön izleme ≤ 10 sn arka planda; 1 M'de ölçülür) ve ölçüm planı (ders 47, 53); 'NASIL BOZULUR?' listesi (planın §8 + G10 + bugünkü koddan gördüklerin); test planı (kâhin karşılaştırması, 2.5.0'ın GERÇEK koduyla üretilmiş veri, değişmezler, yarıda kesilme).
4. D4 TASARIM İSKELETİ: kopyada üret → doğrula → takas adımları D2 sözleşmesiyle; GÖÇ GEREKSİNİMİ (yalnız ihtiyacı yaz — numarayı ana oturum dağıtır); Devri Yenile / Devri Geri Al; kilit ve yazma yolları; belgeler / arşiv; bakım kipi; 001 ile 002+ şirket farkı; yarıda kesilme ve yeniden başlatma; Windows dosya işlemleri (ders 48); Ç3'ten kalan 'kilitli dönem eşzamanlı kipi 1 M'de ana iş parçacığında tek işlem' maddesi.
5. SORULAR: G13'ün dört sorusu + taramada çıkan her para / kapama / 'kime kaç kez' sorusu. Önce yanıtı ARA (G14, kural kitabı, iş listesi C / D); yanıtlanmış olanı kaynağıyla 'YANITLANMIŞ' yaz; kalanlar 'KULLANICIYA SORULMALI' (numaralı; iki seçenek + öneri + her seçenekte hangi sayı ne olur; uç durumsa üçüncü seçenek). Soruları kullanıcının anlayacağı dille yaz (hesap kodunun yanında ne olduğu).
6. PAKETLEME ÖNERİSİ: D3, D4, D5, D6 için dosya sınırları, sıra, hangileri paralel koşabilir (dosya çakışması tablosu), her paketin kabul koşulları, tahmini büyüklük.
7. KÂHİN BAKIMINA GİRDİ: kâhin dizinine göre devir senaryolarının hangileri var, hangileri eksik — yalnız eksik SINIFIN adı ve karar dayanağı (kâhine gidecek kural metnini YAZMA; onu ana oturum karar metinlerinden yazar — ders 5, 40).

## Çıktılar
`docs/devir/D3-D4-TASARIM.md` (bölüm 1–4, 6) + `docs/devir/2.5.1-DEVAM/pd-rapor.md` (bölüm 5, 7 + özet). `docs/devir/DEVIR-PLANI.md`'ye DOKUNMA (eskiyen yerleri raporda listele). Commit yalnız `docs/devir/**`.

{kurallar('pd', kod=False)}

{rapor(kod=False)}
"""

# ---------------------------------------------------------------- D4-ÖN
D4ON = f"""Sen DestekOfis projesinde 2.5.1'in D4 ÖN KOŞULLARI KOD ajanısın (D4-ÖN; eforun high). Devir sihirbazı (D3–D5) henüz yok; bu paket onun önünü açan ÜÇ küçük işi yapar. Dosya işlemlerine dokunuyorsun → Windows davranışı bu paketin asıl konusu (ders 18, 48).

{hazirlik()}
3. Sonra oku: `docs/devir/D2-ALTYAPI-TASARIM.md` (§6 kalıcı devir yedeği, §12 'D3–D6 için girdiler', §9 nasıl bozulur), `docs/devir/DEVIR-PLANI.md` G5 ve G8.

## Kararlar ve bulgular (AYNEN)
İŞ LİSTESİ B (26.11): "WINDOWS DEVİR YEDEĞİ TAŞIMA (CI, Test windows-latest Node 22; bir test kırmızı): devir yedeğinin '.yaziliyor' klasörü son adına alınırken EPERM (Windows'ta yeni yazılan dosyayı antivirüs / dizinleyici kısa süre tutabiliyor). Devir yedeği oluşturma yolunda yeniden deneme YOK (programın başka iki taşıma yolunda var). 2.5.0'da kullanıcıya açık oluşturma yolu YOK (yalnız liste / doğrula; oluşturmayı yalnız testler çağırıyor) → program / kullanıcı etkilenmez; aynı test iki başka commit'te Windows Node 22 YEŞİL. 2.5.1: D3 (sihirbaz) bu yolu açmadan ÖNCE taşımaya Windows yeniden denemesi + Windows'ta zorla üretilen kırmızı (ders 18, 48)."
D2 TASARIM §12: "Belge temizliği arşivin başvurularını henüz görmüyor (G8, documents.mjs purge): D2'de arşiv üreten yol olmadığından risk yok; D4'ten önce eklenmeli (yoksa yeni yılda silinen belge 30 gün sonra diskten gider, arşivin gösterdiği dosya da)." ve "Yorum tutarsızlıkları: `audit_events` D2'de ŞİRKET VERİSİ sayıldı …; `test/sema-kapisi-bs7.test.mjs` test 3'ün 001'de audit_events'i ortak katman gibi atlaması yalnız ölçüm kolaylığı — yorum orada düzeltilmeli. `server/routes/ledger.mjs` ~186 'mahsup tablosuna yazım tam kapıya düşer' yorumu — ayrı küçük iş."
PLAN G8: arşiv, `belgeler/` klasörünü şirket klasöründen okur (arşiv ile çalışma yılı AYNI belge klasörünü paylaşır); belge temizliği arşivin başvurularını görmelidir.
{KURALLAR_KULLANICI}

## İş (sırayla; her biri ÖNCE bugünkü kodda yeniden üretilir — ders 6)
0. NASIL BOZULUR (rapor taslağının başına, koddan ÖNCE, commit): taşıma bir / birkaç kez geçici hata (EPERM, EBUSY, EACCES, ENOTEMPTY) verir; kalıcı hata verir; hedef ad zaten var; yarım klasör kalır; süreç taşıma sırasında ölür; aynı anda iki yedek; belge çalışma yılında silinmiş ama arşiv gösteriyor; arşiv kaydı var ama dosyası açılamıyor (bozuk / eksik / kilitli) — bu durumda belge SİLİNMEZ (güvenli taraf); arşivsiz şirket (bugünkü davranış AYNEN); iki şirket; birden çok arşiv yılı; arşivin kendi silinmiş (30 günü geçmemiş) belge kaydı.
1. İŞ 1 — DEVİR YEDEĞİ TAŞIMASINA YENİDEN DENEME: `server/lib/devir/devir-backups.mjs`'te `.yaziliyor` klasörünün son adına alınması; programın öbür taşıma yollarındaki mevcut yeniden deneme yardımcısını (ara: `git grep -n -E "EPERM|EBUSY" -- server`) KULLAN — ikinci bir yardımcı yazma. Geçici hata türlerinde sınırlı yeniden deneme, kalıcı hatada anlaşılır Türkçe hata + yarım klasörün listede 'yarım' kalması (bugünkü sözleşme), yeniden denenmeyen hata türünde hemen hata. Bekleme olay döngüsünü ne kadar tutar — yaz (yedek zaten bakım kipinde alınacak).
   TESTLER: (a) hata enjeksiyonuyla (taşıma n kez geçici hata → başarı; kalıcı hata → hata + 'yarım'; yeniden denenmeyen tür → hemen) — tabanda BEKLENEN NEDENLE kırmızı; (b) WINDOWS'TA GERÇEK ÖN KOŞUL (ders 20, 48): yalnız `process.platform === "win32"` iken koşan bir vaka — klasörün içindeki bir dosyayı kısa süre AÇIK TUTAMAKLA tutup taşımayı başlat, tutamak bırakılınca taşımanın yeniden denemeyle BAŞARDIĞINI göster; Linux'ta bu vaka 'atlandı' DEĞİL, enjeksiyonlu eşdeğeriyle koşar (CI kapısı Linux ve Windows'ta AYNI sayıda test ister, atlanan test kabul etmez — test sayısı iki platformda eşit kalacak biçimde yaz). Windows sonucunu sen göremezsin; raporda 'ana oturum CI Windows'ta iki koşu okuyacak' diye yaz ve eski kodda Windows'ta beklenen kırmızının iletisini tahmin etme — 'OKUNMADI' yaz.
2. İŞ 2 — BELGE TEMİZLİĞİ ARŞİVİ GÖRSÜN: `server/lib/documents.mjs` temizliği, bir dosyayı ancak NE çalışma yılının NE de o şirketin kayıtlı arşivlerinden herhangi birinin belge kaydı gösteriyorsa siler. Arşivlerin listesi ve salt okunur açılması D2'nin katmanından (arşiv kayıt defteri + arşivi açmadan önce hazırlık) — arşive YAZMA, arşivi göç ETTİRME (temizlik yalnız okur; açılamayan arşiv = 'gösteriyor say', silme). Arşivi olmayan şirkette davranış ve hız AYNEN (tek ek maliyet: arşiv listesinin okunması). Temizliğin çağrıldığı yeri bul; arşiv bilgisini oraya en küçük bağlamayla ver.
   TESTLER: D2'nin arşiv kaydıyla kurulmuş arşivli şirket (test düzeneği D2 testlerinden) — çalışma yılında silinmiş + 30 günü geçmiş belge arşivde duruyorsa dosya KALIR (tabanda SİLİNİR — kırmızı nedeni bu); arşivde de yoksa silinir; iki arşiv yılı; açılamayan arşiv → kalır; arşivsiz şirket bugünkü gibi. Dosya sayıları diskten okunur.
3. İŞ 3 — İKİ YORUM DÜZELTMESİ (yalnız yorum; davranış değişmez): `test/sema-kapisi-bs7.test.mjs` test 3'teki audit_events açıklaması ve `server/routes/ledger.mjs`'teki 'mahsup tablosuna yazım tam kapıya düşer' yorumu — koddan doğru olanı okuyup düzelt; emin değilsen DOKUNMA, raporda yaz.

## Kabul koşulları
A. Yeni testler tabanda beklenen nedenle kırmızı, yenide yeşil; iki TZ. B. KOMŞULAR (ders 10): devir yedeği, arşiv, belge, yedek / geri yükleme, şema kapısı testleri `git grep` taramasıyla, iki TZ — sayılar raporda. C. MUTANTLAR DEĞERLE (en az: yeniden denemeyi kaldır; kalıcı hatayı yut; arşiv başvurusunu yok say; açılamayan arşivi 'göstermiyor' say; yalnız ilk arşive bak) — her biri en az bir testte kırmızı. D. Linux'ta açık tutamak sayısı: arşivi okuyan temizlikten sonra arşiv bağlantısı KAPANMIŞ mı (`/proc/self/fd` ile ölç — ders 48). E. Hız: arşivsiz şirkette temizlik süresi önce / sonra (kaba ölçüm yeter; sayıyla).

## Dosya sınırı
`server/lib/devir/devir-backups.mjs`; mevcut yeniden deneme yardımcısının dosyası (YALNIZ dışa açmak gerekiyorsa; davranış aynen); `server/lib/documents.mjs` + temizliği çağıran yerde yalnız bağlama satırı; testler + `test/fixtures/**`; İş 3'ün iki yorumu. Başka her dosya YASAK.

{kurallar('d4on')}

{rapor()}
"""

# ---------------------------------------------------------------- Mİ
MI = f"""Sen DestekOfis projesinde 2.5.1'in MÜŞTERİ İSTEKLERİ KOD ajanısın (Mİ; eforun high). İki istek: Mİ-1 (küçük) ve Mİ-2 (orta — yeni görünüm). İkisi de Cari ekranında. ÖNCE Mİ-1'i bitir ve commit et, sonra Mİ-2.

{hazirlik()}
3. Sonra oku: Cari ekranının istemci ve sunucu kodu (liste, süzgeçler, kartlar, PDF / Excel / Yazdır), taksit kartı görünümünün numara ürettiği yerler, Rapor Merkezi'ndeki 'Cari Bazında Tahsilat' raporu (`server/routes/report-center.mjs` — YALNIZ OKU; bu dosya başka ajanda, DEĞİŞTİRME).

## Kararlar (AYNEN)
Mİ-1 — KULLANICI 27.11 (AYNEN): "müşterinin isteği var; geciken taksit gününü gösteriyor ya programımız; 20 gün gecikti vb diyorya onun yanına parantez içinde 2. taksit yazılabilirmi hangi taksit geciktiyse o yazılacak".
Mİ-1 BAŞ MİMAR KARARLARI (kullanıcıya gösterildi): (a) Cari listesinin Taksit sütunundaki satır "15.10.2026 · 29 gün gecikti" → "15.10.2026 · 29 gün gecikti (2. taksit)" (satır cümle düzeninde, küçük harf — bugünkü "sıradaki taksit" ile aynı düzen); numara, gün sayısının AİT OLDUĞU taksitin kendi kartındaki sırasıdır; birden çok kart / birden çok geciken varsa bugünkü kural AYNEN (satır hangi taksitten üretiliyorsa o). (b) Listenin PDF / Excel / Yazdır çıktısında bu satır varsa orada da aynı. (c) 2.5.0 BİLİNEN SINIR "silinen taksitten sonra sıra numarasında boşluk" ('1.', '3.' — sayılar doğru, yalnız görünüm) bu işle birlikte düzelir: listede yazan numara ile kartta görünen numara AYNI kaynaktan (tek yardımcı) gelir ve boşluksuzdur.
Mİ-2 — KULLANICI 27.11 (AYNEN): "mesela buna biz cari grupları açtık ya gruba göre bugün ne kadar kasaya giriş olmuş onu istiyor, yani A grubundaki öğrenciler bugün ne kadar ödeme yapmış gibi. cari gruplarına göre geciken taksitler, o gruptan toplam alınan ödemeler, o grubun carilerinden geciken geciken taksitler gibi çeşitli filtrelemeler yapılabilsin bu ekrandan. A grubu carisi, B grubu carisi, yada firma hangi isimlerle kaç tane cari grubu açtıysa, grup bazında çeşitli senaryoları görüntüleme seçenekleri ekle".
Mİ-2 — KULLANICI 27.11 (AYNEN): "kasaya giriş derken tüm tahsilat yollarını kastettim. nakit, pos, havale, çek, senet. önerin yani".
Mİ-2 BAŞ MİMAR TASARIMI (kullanıcıya gösterildi, onaylandı):
 (a) Cari ekranında "Grup Özeti" görünümü (Liste ↔ Grup Özeti geçişi): firmanın açtığı HER grup bir satır, alt gruplar açılır kırılım, grubu olmayan cariler "Grupsuz" satırında; sütunlar Cari Sayısı, Bakiye, Taksitlerden Kalan, Geciken Tutar, Geciken Taksit, Tahsilat (seçilen dönem; Toplam + Nakit / POS / Havale-EFT / Çek / Senet kırılımı); altta TOPLAM; satıra tıklayınca Liste o gruba süzülmüş açılır; PDF / Excel / Yazdır ekranla aynı.
 (b) Dönem seçici (Bugün, Dün, Bu Hafta, Bu Ay, Tarih Aralığı): Liste görünümüne "Tahsilat" kartı ve sütunu + "Bu Dönemde Ödeme Yapanlar" süzgeci; grup / alt grup / tür / gecikme süzgeçleriyle BİRLİKTE çalışır; kartlar süzgeçten SONRA toplanır (bugünkü kural).
 (c) TAHSİLAT TANIMI 'Cari Bazında Tahsilat' raporuyla AYNI (kalıcı karar 03.10.2026: Excel'den gelen önceden ödenen AYRI gösterilir, dönemlik tahsilat toplamına karışmaz — raporun bugünkü düzenini oku, ona uy); müşteriden ALINAN para sayılır, tedarikçiye yapılan ödeme sayılmaz. Yol kırılımı tahsilatın kaydındaki yoldan; yolu belirlenemeyen varsa "Diğer" sütunu + raporda adıyla.
 (d) Rapor Merkezi kısmı (gruba göre rapor + üç rapora grup süzgeci) BU TURDA YOK — `report-center.mjs` başka ajanda; sonraki tura.
 KURALLAR: carinin eski tahsilatı BUGÜNKÜ grubunda sayılır (grup geçmişi tutulmuyor — teslim notuna yazılacak); yetki mevcut cari yetkileriyle (tahsilat tutarını bugün göremeyen rol bu sütunları da göremez — koddan oku, raporda yaz); toplam = satırlar, HER süzgeç seçeneğiyle (ders 11).
ANAYASA: "Raporlar: her raporda alt TOPLAM satırı (ekran/PDF/Excel aynı)"; yazım düzeni; "Cari yalnız '+ Yeni Cari' ve 'Excel / Sheets'ten Yükle' ile açılır".
{KURALLAR_KULLANICI}

## İş
0. NASIL BOZULUR (rapor taslağının başına, koddan ÖNCE, commit): Mİ-1 — taksiti silinmiş / düzenlenmiş kart, iade görmüş kart, kapalı kart, birden çok kart, bağsız tahsilatla sırası kayan kart, açılıştan gelen kart, numaranın makbuz / ekstre / WhatsApp iletisi gibi BAŞKA yerlerde de yazılması. Mİ-2 — grubu olmayan cari, alt gruplu grup, boş grup, pasif cari, aynı adlı iki cari, tedarikçi, dönemde hiç tahsilat yok, ileri tarihli tahsilat, silinmiş / geri alınmış tahsilat, karşılıksız çıkan çek, iade, taksit tahsilatı ↔ cari tahsilatı çift sayımı, aynı gün birden çok yol, gece yarısı / ay başı / yıl başı (ders 13, 22), iki şirket, yetkisiz rol, 2.000+ cari.
1. Mİ-1 TARAMA + KOD: taksit numarasının üretildiği / gösterildiği HER yer (tablo: yer, bugün hangi sayı, ne yapıldı). Numara TEK yardımcıdan ve boşluksuz. DİKKAT: (i) saklanan veri / göç gerekiyorsa DUR — 'BAŞ MİMAR KARARI GEREKİYOR'; (ii) numara müşteriye GİDEN bir metinde (WhatsApp iletisi, makbuz, ekstre) yazılıyorsa orada sayı DEĞİŞECEKSE önce raporda yaz, o yere DOKUNMA ('KULLANICIYA SORULMALI' — gönderilmiş iletinin içeriğiyle çelişebilir); yalnız ekran + liste çıktısı bu turun kapsamı. Testler: silinmiş taksitli kartta boşluksuz numara; listede yazan numara = kartta görünen numara; geciken yokken ek yok; PDF / Excel.
2. Mİ-2 TASARIM NOTU (kısa; `docs/devir/2.5.1-DEVAM/mi2-tasarim.md`; koddan ÖNCE, commit): veri kaynağı (cari grupları nerede tutuluyor; tahsilatın yolu nereden okunuyor), uçlar, hacim bütçesi, ekran düzeni (kısa çizim), her sütunun TANIMI ve hangi mevcut sayıyla aynı olması gerektiği.
3. Mİ-2 KOD: dönemlik tahsilatı cari başına veren YENİ bir sunucu yardımcısı (yeni dosya; toplu SQL — cari başına ağır okuma YOK, ders 47); Liste ucuna dönem + "Bu Dönemde Ödeme Yapanlar" süzgeci + kart; Grup Özeti ucu; istemcide görünüm geçişi, dönem seçici, sütunlar, tıklayınca süzme, PDF / Excel / Yazdır. Dönem seçilmemişken Liste'nin yanıtı ve süresi BUGÜNKÜ gibi kalır.
4. TESTLER: (a) EŞDEĞERLİK — aynı veri ve aynı dönem için yeni yardımcının cari başına toplamı = 'Cari Bazında Tahsilat' raporunun satırı (rapor BAĞIMSIZ beklenen; fark çıkarsa önce hata say — ders 6, nedenini yaz); (b) elle hesaplanmış küçük senaryo (her yol birer tahsilat, iki grup + grupsuz, alt grup) — beklenen sayılar testte ELLE yazılı; (c) grup satırlarının toplamı = TOPLAM = süzgeçsiz Liste kartları; her süzgeç seçeneği; (d) nasıl bozulur listesinin her maddesi; (e) yetkisiz rol; (f) EKRAN senaryosu (gerçek tıklama, insan hızı, klavye — ders 12): müşterinin iş akışı baştan sona — grup aç → cari → taksit → her yoldan tahsilat → Grup Özeti'nde sayılar → satıra tıkla → Liste → Excel; ekran görüntüleri kanıt klasörüne; sayılar veri tabanından.
5. HIZ (ders 47, 53): temiz 100 bin `{SP}/ana-kabul/temiz-100k` (OKUNUR; KENDİ kopyanda /dev/shm) — Liste (dönemsiz) taban ↔ yeni; Liste (dönemli); Grup Özeti. Bütçe: Grup Özeti ve dönemli Liste ≤ 2 sn, olay döngüsü en çok değeri de yazılır; dönemsiz Liste tabana göre %10'dan kötü değil. Ölçüm ÖZEL kilitle: `flock -x -w 1800 {SP}/olcum.lock` tek seferlik (alamazsan 'ÖLÇÜLEMEDİ'); her koşu başında /proc/loadavg; yük > 2 ise 'GEÇERSİZ'.

## Kabul koşulları
A. `npm run test:kahin-cari` ve `npm run test:kahin-defter` tabanda ve sonda (iki TZ) — sayılar AYNI (bu iş para yazmaz; fark = hata). B. KOMŞULAR (ders 10): cari listesi, cari çıktıları, taksit kartı görünümü, numara gösteren her test `git grep` ile, iki TZ. C. MUTANTLAR DEĞERLE (en az: numarayı saklanan sıradan al; tedarikçi ödemesini say; önceden ödeneni dönem toplamına kat; grupsuzları düşür; alt grubu üst gruba katma; dönem sınırını bir gün kaydır; silinmiş tahsilatı say; yol kırılımında çek ile seneti karıştır) — her biri en az bir testte kırmızı. D. Beklentisi değişen her ekran senaryosu KOŞULUR (ders 28).

## Dosya sınırı
Cari ekranının istemci dosyaları (+ stil), `server/routes/accounts.mjs` (liste ucu + yeni uçlar), YENİ sunucu yardımcı dosyası, taksit numarasının gösterim yardımcıları (istemci + sunucu; YALNIZ numara gösterimi), liste çıktısı (PDF / Excel / Yazdır) kodu, testler + `test/fixtures/**`, `docs/devir/2.5.1-DEVAM/mi2-tasarim.md`. YASAK: `server/routes/report-center.mjs`, tek borç sırası / defter / banka / WhatsApp / e-Belge / devir kodu (okuma serbest), göçler.

{kurallar('mi')}

{rapor()}
"""

# ---------------------------------------------------------------- M1
M1 = f"""Sen DestekOfis projesinde 2.5.1'in KDV ÖZETİ DEVREDEN KDV KOD ajanısın (M1; eforun high). Mali müşavir ara kabulünün ORTA bulgusu (S261): KDV Özeti raporu önceki aydan devreden KDV'yi görmüyor. Defter ve KDV Mahsup Fişi DOĞRU — yalnız RAPOR değişecek; mahsup fişinin / defterin davranışı DEĞİŞMEZ.

{hazirlik()}
3. Sonra oku: `docs/devir/2.5.0-DEVAM/ma-rapor.md` (ORTA-1 bölümü ve 'KULLANICIYA SORULMALI' — mali müşavir kodu GÖRMEDEN yazdı; oradaki beklenen sayılar BAĞIMSIZ beklenendir); KDV Özeti raporunun ve KDV Mahsup Fişi ön izlemesinin kodu.

## Kararlar (AYNEN)
S261 (iş listesi C): "MALİ MÜŞAVİR ARA KABULÜ ORTA-1 — ana oturum iki TZ'de BİREBİR yeniden üretti: Ocak alış KDV 2.000 + Ocak mahsubu (sonraki aya devreden 2.000), Şubat satış KDV 1.200 → Şubat KDV Özeti 'Ödenecek KDV 1.200,00 TL', Şubat mahsup fişi ön izlemesi önceki aydan devreden 2.000 / sonraki aya devreden 800 / ödenecek 0; ÖNCEDEN VAR — 2.4.3'ten beri, defter ve mahsup fişi DOĞRU): KDV Özeti (Beyanname Hazırlığı) özetinin ve tablo altının 'Ödenecek / Devreden KDV' satırı önceki aydan devreden KDV'yi görmüyor; 391 / 191 satırları iadeleri düşülmüş gösteriyor."
KULLANICI 22.11 19:47 UTC (AYNEN): "orta bulguyu 2.5.1 de düzeltelim" → düzeltme: devreden satırı + mahsup formülüyle ödenecek / devreden + 391 / 191 adları.
MALİ MÜŞAVİRİN BEKLEDİĞİ (ma-rapor.md ORTA-1): Şubat mahsubunda 1.140 devreden oluşmuş, Mart ve Nisan'da taşınmış, Mayıs'ta satış KDV'si 1.200 → Mayıs ödenecek KDV 60 (1.200 − 1.140). Temmuz'dan 2.000 devreden, Eylül hesaplanan 660, indirilecek 620 → Eylül ödenecek 0, sonraki aya devreden 1.960. Yıllık görünümde program 'Devreden KDV 1.100' diyordu; defterdeki 190 ise 1.960. "Önceki dönemden devreden KDV beyannamede ayrı satırdır." En küçük öneri: özete "Önceki Dönemden Devreden KDV" satırı + ödenecek / devreden mahsup fişindeki formülle; 391 / 191 adlarına iadelerin düşüldüğünü söyleyen ek ya da iadeleri beyannamedeki yerinde göstermek.
BAŞ MİMAR KARARLARI (kullanıcıya gösterilecek; değiştirebilir): (1) Formül TEK yerden — KDV Mahsup Fişi ön izlemesinin kullandığı hesap; rapora İKİNCİ bir formül yazılmaz (gerekirse mevcut hesap dışa açılır, davranışı aynen). (2) Satır adları: "Önceki Dönemden Devreden KDV", "Ödenecek KDV", "Sonraki Döneme Devreden KDV"; 391 / 191 satırlarının adına "(İadeler Düşülmüş)" eki (iadelerin yerini değiştirmek yok — en küçük değişiklik). (3) Çok aylı / yıllık aralıkta: 'Önceki Dönemden Devreden' = aralığın İLK ayından önce devreden; 'Sonraki Döneme Devreden' = aralığın SON ayının devredeni; aylık satırlarda her ay kendi devreden / ödenecek değeriyle. (4) Tablo altındaki 'Net KDV' satırı da aynı hesapla (bugünkü 'Net KDV (Ödenecek / Devreden)' adı gerekiyorsa değişir — yazım düzeni).
AÇIK NOKTA (KODLAMADAN ÖNCE koddan oku; iki okuma çıkarsa 'KULLANICIYA SORULMALI'): önceki ayların KDV Mahsup Fişi KESİLMEMİŞSE mahsup ön izlemesi 'önceki aydan devreden'i nereden alıyor (defterdeki 190 bakiyesi mi, ay ay hesap mı)? Rapor mahsup ön izlemesiyle AYNI sayıyı göstermeli; mahsubu kesilmemiş ay varsa raporda kullanıcıya bunu söyleyen bir not gerekip gerekmediğini öner (karar ana oturumda).
ANAYASA: ekran = PDF = Excel, alt TOPLAM satırı; yön karışık raporda her yön için ayrı TOPLAM + Net satırı (2.4.3 kararı — bugünkü düzen korunur).
{KURALLAR_KULLANICI}

## İş
0. NASIL BOZULUR (rapor taslağının başına, koddan ÖNCE, commit): devreden hiç yok; devreden birkaç ay taşınır; ödenecek aydan sonra yeniden devreden; mahsup fişi kesilmemiş ay; mahsup fişi silinmiş / yeniden kesilmiş; aralık yıl başını aşıyor (önceki yıldan devreden); tek ay / çeyrek / yıl / boş dönem / gelecek dönem; iadeler; tevkifat; KDV İndirim Dönemi başka aya atılmış alış faturası (2.5.0 kuralı — rapor ve mahsup ay ay aynı kalmalı); kilitli dönem; Defter Türü bilanço dışı; yetkisiz rol; iki şirket.
1. TARAMA (koddan ÖNCE; tablo): KDV Özeti'nin 'Ödenecek / Devreden' ve 'Net KDV' değerini üreten ve gösteren HER yer (rapor gövdesi, özet satırları, tablo altı, PDF, Excel, varsa başka ekran / anlık durum / zil); mahsup ön izlemesinin hesabı ve girdileri.
2. KOD: yukarıdaki kararlar. Raporun öbür sütunları ve satırları DEĞİŞMEZ.
3. TESTLER: S261 örneği (Şubat: önceki dönemden devreden 2.000, ödenecek 0, sonraki döneme devreden 800) ve mali müşavirin Mayıs (60) / Eylül (0; 1.960) / yıllık beklentileri — senaryoyu programın API'sinden KUR (elle tablo yazma yok), beklenen sayılar testte mali müşavirin sayılarıyla ELLE yazılı; rapor = mahsup ön izlemesi (ay ay, aynı veri); nasıl bozulur listesinin her maddesi; ekran = PDF = Excel aynı sayılar; tabanda BEKLENEN NEDENLE kırmızı (ör. 'Ödenecek KDV 1.200,00'); ekran senaryosu (Raporlar → KDV Özeti; ekran görüntüsü kanıt klasörüne).

## Kabul koşulları
A. `npm run test:kahin-defter` tabanda ve sonda (iki TZ) — AYNI (defter değişmedi). B. Muhasebe sürücüsü (`test/bagimsiz/muhasebe-surucu`; DEĞİŞTİRME) KDV Özeti çıktısını okuyorsa taban ↔ son farkını adıyla raporla (beklenen fark yalnız bu rapor). C. KOMŞULAR (ders 10): KDV Özeti, KDV mahsup, vergi ödemesi, Rapor Merkezi çıktı testleri `git grep` ile, iki TZ. D. MUTANTLAR DEĞERLE (en az: devredeni sıfır al; devredeni iki kez düş; çok aylı aralıkta ilk ay yerine son ayın devredenini 'önceki dönem' say; mahsup formülü yerine eski dönem farkını kullan; ödenecek ile devredeni ters yaz) — her biri en az bir testte kırmızı. E. Beklentisi değişen her test / ekran senaryosu KOŞULUR (ders 28). F. Hız: KDV Özeti'nin yıllık açılışı temiz 100 bin `{SP}/ana-kabul/temiz-100k` kopyasında (KENDİ kopyan, /dev/shm) taban ↔ yeni; tabana göre %10'dan kötü değil; ÖZEL kilit `flock -x -w 1800 {SP}/olcum.lock` tek seferlik (alamazsan 'ÖLÇÜLEMEDİ'); yük > 2 ise 'GEÇERSİZ'.

## Dosya sınırı
`server/routes/report-center.mjs` (YALNIZ KDV Özeti raporu ve onun kullandığı yardımcılar); mahsup hesabının dosyası (YALNIZ hesabı dışa açmak; davranış aynen); raporun tablo altını / özetini gösteren istemci kodu (yalnız bu raporun satırları); testler + `test/fixtures/**`. YASAK: Cari ekranı (`server/routes/accounts.mjs` ve istemcisi — başka ajanda), defter / fiş / dondurma / devir kodu, göçler.

{kurallar('m1')}

{rapor()}
"""

# ---------------------------------------------------------------- D3 (27.11; P-D tasarımından sonra)
D3 = f"""Sen DestekOfis projesinde 2.5.1'in D3 KOD ajanısın (devir: SAF HESAP + DEVİR RAPORU + ÖN DENETİM; PARA ÇEKİRDEĞİ; eforun high). D3 HİÇBİR ŞEY YAZMAZ: şirketin verisinden devrin bütün sonucunu bir DEVİR PLANI nesnesi olarak hesaplar; ön izleme sayıları, Devir Raporu ve (sonraki paket D4'ün) yazımı AYNI nesneden gelir. Tasarım hazır: `docs/devir/D3-D4-TASARIM.md` §3 — onu UYGULARSIN; tasarımdan sapman gerekirse KODLAMA, raporda 'BAŞ MİMAR KARARI GEREKİYOR'.

{hazirlik()}
3. ÖNEMLİ: tasarım notu taban etiketinde YOK — ana ağaçtan OKU: `{ANA}/docs/devir/D3-D4-TASARIM.md` (§1.2 çekirdeğin planı eskittiği yerler, §2 tablo sınıflaması, §3 TAMAMI, §4.4 devirli dosyanın kuralları — yalnız D3 planının türlerini etkilediği kadar, §6.1 D3 satırı) ve `{ANA}/docs/devir/2.5.1-DEVAM/pd-rapor.md` (§5 sorular ve yanıtlanmış kararlar). Sonra `docs/devir/DEVIR-PLANI.md` (G bölümü geçerli; G14), `docs/devir/D2-ALTYAPI-TASARIM.md` §12, kural kitabının devir / kapanış bölümleri (`docs/erp/MUHASEBELESTIRME-KURAL-KITABI.md` + ekleri — kural adları N-01 … N-14, M1 … M13 oradan). Bu iki belgeyi kendi ağacına KOPYALAMA / commit ETME (ana oturum birleştirdi).

## Kararlar
KULLANICI 21.11 21:32 UTC (AYNEN: "haftalık limit devir için kalan adımlara yetmeyecek. D3 den D6 ya kadar olan kısmı 2.5.1 sürümüne bırakalım.") + 27.11 (AYNEN: "tüm işler bu sürümde yapılsın").
YANITLANMIŞ KARARLAR: pd-rapor.md §5.1 ve §5.2'deki tablo / liste (kaynaklarıyla) — hepsi GEÇERLİ, kodlanır.
ÜÇ AÇIK SORU (kullanıcıya soruldu; ÖNERİ uygulanıyor, kullanıcı DEĞİŞTİREBİLİR → kodda TEK yerden değişecek biçimde yaz, raporda yerini göster): S-1 = A (590 / 591 yeni yıla AYNEN açılır — D3 planında bugünkü karar; gösterim ve sonraki yılın kapanışı D3'ün işi DEĞİL); S-2 = A ("Açılış Olabilir" listesinde onay bekleyen kayıt varken ön denetim devri DURDURUR); S-3 = A (düzeltilmemiş "Kural Değişikliği Farkı" varken ön denetim devri DURDURUR).
BAŞ MİMAR KARARLARI 27.11 (P-D raporu üzerine; kullanıcıya gösterildi): (1) tasarım notu §3 D3'ün tasarımıdır. (2) Türetilmiş kurallar KABUL: devrin Borç Toplamı / Alacak Toplamı satırları tek borç sırasına girmeden ÖNCE birbiriyle netleşir (iki seçenekte gecikmiş, kalan, bakiye AYNI); vadesiz açık kalemin vadesi asıl belge günü; Ödeme Sözü taşınır; kapalı kart da tek açılış alır; G2 ↔ G3 çelişkisinde G2 geçerli. Değişmez: DEVİRLİ = DEVİRSİZ (devir şirketin durumunu değiştirmez — bakiye, gecikmiş, kalan). (3) B-9 hız: ÖNCE ÖLÇ (bileşen bileşen), sonra öner — kapanış için tam Bilanço yerine hesap bazında mizan kullanmak ancak ölçüm 10 sn bütçesini aşıyorsa ve dönem sonucu / değerleme yine mali tablo hesabının işlevlerinden geliyorsa; kararı raporda sayıyla iste, kendiliğinden İKİNCİ bir kâr hesabı yazma (tek kaynak). (4) B-2: tasarım notu §2'deki sınıflama (adı planda geçmeyen beş defter tablosu dahil) plana girer. (5) Sürücü (`test/bagimsiz/**`) bu turda YOK — kâhin ↔ plan karşılaştırmasını ayrı ajan kurar; sen planın ÇIKTI BİÇİMİNİ raporda tam yaz (alan alan), kâhin dosyalarını OKUMA.
{KURALLAR_KULLANICI}

## İş (tasarım notu §3'ün sırasıyla; her adım bitince commit)
0. NASIL BOZULUR (rapor taslağının başına, koddan ÖNCE, commit): plan §8 (1–16) + G10 (17–28) + tasarım notu §3.11 (29–42) — hangisini hangi testle karşıladığını tabloya yaz; karşılayamadığın 'DENENMEYEN'e.
1. OKUYUCU + PLAN (tasarım §3.1–§3.3, §3.5–§3.8): tek okuma işleminde toplu SQL (cari / öğe başına ağır okuma YOK — ders 47); plan belirlenimli (aynı veri → bayt bayt aynı plan); tutarlar kuruş tamsayı. Tek borç sırası, mali tablo hesabı, stok değerlemesi, defter türetmesi OKUNUR, DEĞİŞTİRİLMEZ — bir işlevi dışa açman gerekiyorsa davranış AYNEN kalır ve raporda ayrıca yazarsın; daha fazlası gerekiyorsa DUR.
2. ÖN DENETİM (plan §5 + G4 + S-2 / S-3): saf; DURDURUR / UYARIR listesi, her madde kullanıcının anlayacağı Türkçe cümle + gidilecek yer.
3. DEVİR RAPORU (tasarım §3.4): satırlar + PDF / Excel üretici (ekran = PDF = Excel; alt TOPLAM satırları; yazım düzeni).
4. ARKA PLAN İŞİ + UÇLAR (tasarım §3.9; yalnız ön izleme — yazan uç YOK): yetki system.manage; aynı şirkette aynı anda tek ön izleme.
5. TESTLER (tasarım §3.12; `test/devir-d3-*`): (a) ELLE HESAPLANMIŞ küçük senaryolar (beklenen sayılar testte ELLE yazılı, kural kitabının örneklerinden: açık kalem, net satır, kapanış sırası 690 → 691 → 692 → 590 / 591, stok değerleme, eksi stok, şüpheli, KDV dönem boyutu, kart); (b) DEVİRSİZ EŞDEĞER — aynı veride planın açılışlarıyla hesaplanan gecikmiş / kalan / bakiye = devirsiz programın K'deki sayıları (iki seçenek × gecikmiş kalem; vadesiz kalem; Ödeme Sözü); (c) GERÇEK VERİ (ders 17): `v2.5.0` etiketinin GERÇEK koduyla (`git worktree add --detach /dev/shm/d3-<kısa>/v250 v2.5.0`) API'den üretilmiş çok aylı veri (001 + 002) üzerinde plan + değişmezler; (d) değişmezler: ön izleme sayıları = planın yazım kümesi, arşiv ≤K + yeni yıl >K = devir öncesi satır sayısı, her bilanço hesabı kapanış = açılış, 6 / 7 sınıfı kapanış sonrası 0; (e) ön denetimin her maddesi; (f) iş parçacığı öldürülünce veri aynı; iki TZ, sahte saat 31.12 23:59 / 01.01 00:00, Şubat'ta devir, 29 Şubat'lı yıl (ders 13, 22); (g) iki şirket; 001'de budama sayıları ortak katmanı saymaz.
6. HACİM (tasarım §3.10; ders 47, 52, 53): temiz 100 bin `{SP}/ana-kabul/temiz-100k` (OKUNUR; KENDİ kopyanda /dev/shm) — bileşen bileşen (okuma, yevmiye, tek borç sırası, değerleme, plan, rapor) + toplam + olay döngüsü en çok; ÖZEL kilit `flock -x -w 1800 {SP}/olcum.lock` tek seferlik (alamazsan 'ÖLÇÜLEMEDİ'); /proc/loadavg yazılır, yük > 2 ise 'GEÇERSİZ'. Bütçe: 100 bin satırda ≤ 10 sn (iş parçacığında), olay döngüsü en çok ≤ 50 ms. 1 M ÖLÇME (ana oturum ölçecek) — betiğini bırak.

## Kabul koşulları
A. `npm run test:kahin-defter` ve `npm run test:kahin-cari` tabanda ve sonda (iki TZ) AYNI (var olan hiçbir yolun yanıtı değişmedi). B. KOMŞULAR (ders 10): devir (D2), tek borç sırası, mali tablo hesabı, değerleme, dondurma testleri `git grep` ile, iki TZ. C. MUTANTLAR DEĞERLE (tasarım §3.12 listesi: açık kalem vadesi, net satır formülü ve netleşmesi, şüpheli payı, dönem sonu stok tutarı, 691 → 692, kapanış sırası, KDV dönem etiketi, kartın tükettiği kalemin dışlanması, bakiyesi 0 cariye satır yazılmaması + ön denetimin iki DURDURUR maddesi) — her biri en az bir testte kırmızı. D. Yeni modülde 'eski kodda modül yok' kırmızısı kanıt SAYILMAZ; dişi (b) devirsiz eşdeğer + (a) elle sayılar + mutasyon taşır — raporda böyle yaz.

## Dosya sınırı
YENİ: `server/lib/devir/plan.mjs`, `plan-reader.mjs`, `preflight.mjs`, `report.mjs`, `plan-worker.mjs`; `server/routes/devir.mjs` (yalnız EK ön izleme uçları); `test/devir-d3-*` + `test/fixtures/**`. OKUR (DEĞİŞTİRMEZ; yalnız davranışı aynen dışa açma serbest, raporda yazılır): tek borç sırası, mali tablo hesabı, stok değerlemesi, defter türetmesi, D2 modülleri. YASAK: istemci (ekran D5'te), göçler, `server/app.mjs`'te bağlama satırı DIŞINDA değişiklik, KDV mahsup hesabı ve Rapor Merkezi (başka ajanda), Cari ekranı (başka ajanda), `test/bagimsiz/**`.

{kurallar('d3')}

{rapor()}
Ek olarak raporda: DEVİR PLANI nesnesinin TAM biçimi (alan alan; sürücü ajanı buradan okuyacak); hacim tablosu (bileşen bileşen); B-9 için ÖLÇÜLMÜŞ öneri; D4a'nın D3'ten beklediği türler; S-1 / S-2 / S-3 yanıtı değişirse dokunulacak TEK yer.
"""

# ---------------------------------------------------------------- M1 TUR 2 (27.11; S-M1-1 = B önerisi)
M1T2 = f"""Sen DestekOfis projesinde 2.5.1'in M1 TUR 2 KOD ajanısın (KDV Özeti — devreden KDV'nin ZİNCİRLİ hesabı; eforun high). Tur 1 başka bir ajanla bitti (dal ucu etiketi t251-m1-tur1); sen temiz bağlamla YALNIZ aşağıdaki değişikliği yaparsın (ders 46). Defter, KDV Mahsup Fişi ve onun ön izlemesi DEĞİŞMEZ — yalnız RAPOR.

{hazirlik(taban="t251-m1-tur1", taban_ne="M1 tur 1'in dal ucu (60f1a0a7)")}
3. Sonra oku: `docs/devir/2.5.1-DEVAM/m1-rapor.md` (tur 1'in raporu — özellikle §1 tarama, §7 S-M1-1, §8 kararlar), tur 1'in görev metni `{ANA}/docs/devir/2.5.1-DEVAM/m1-istem.txt` (kararlar AYNEN geçerli; yalnız aşağıda DEĞİŞENLER geçersiz kılar), tur 1'in kodu (`git diff t251-taban..t251-m1-tur1 -- server test`) ve betikleri `docs/kanit/2026-11-27/m1-betik/`.

## Kararlar
KULLANICI 22.11 19:47 UTC (AYNEN): "orta bulguyu 2.5.1 de düzeltelim" (S261 — tur 1 görev metninde tam metni).
S-M1-1 (tur 1 raporu §7; kullanıcıya SORULDU 27.11 — ÖNERİ B uygulanıyor, kullanıcı DEĞİŞTİREBİLİR → A ↔ B kodda TEK yerden değişecek biçimde yaz, raporda yerini göster): mahsup fişi kesilmemiş aylarda "Önceki Dönemden Devreden KDV" nereden gelsin? A (tur 1'de kodlanan): defterdeki 190 bakiyesinden (ön izlemeyle aynı; mahsupsuz ayda zincir kopar). **B (ÖNERİ — bu turda kodlanır): ZİNCİRLİ** — her ayın önceki dönemden devredeni, bir önceki ayın sonraki döneme devredenidir; mahsup fişi kesilmemiş ayın sonucu, o ay SIRAYLA mahsup edilmiş olsaydı çıkacak sayıdır (aynı mahsup formülüyle). Tur 1'in örneği: Eylül sonu devreden 1.960, Ekim satış KDV 400 MAHSUP EDİLMEDİ, Kasım satış KDV 1.000 → Kasım: önceki 1.560 / ödenecek 0 / sonraki 560 (A'da 1.960 / 0 / 960). Gerekçe: rapor beyanname hazırlığıdır; beyannamedeki devreden programın iç mahsup fişinin kesilip kesilmediğine bağlı değildir; mahsup fişini hiç kullanmayan şirkette A yıllık devredeni yalnız son ayın farkına indiriyor (100 bin verisinde 7.978,23 ↔ birikmiş ~3,3 milyon).
BAŞ MİMAR KARARLARI 27.11 (kullanıcıya gösterilecek; değiştirebilir):
 (1) ZİNCİRİN TANIMI: aylar takvim sırasıyla işlenir; ayın farkı tur 1'deki mahsup hesabıyla (TEK formül — ikinci formül yazılmaz). Devreden yöndeki sonuç sonraki aya taşınır; ödenecek yöndeki sonuç taşınmaz (ödenir). Hareketsiz ay devredeni aynen taşır.
 (2) ZİNCİRİN BAŞLANGICI: şirketin KDV hareketi olan ilk ayından önceki devreden = defterdeki 190'ın o andaki bakiyesi (açılıştan gelen devreden varsa o; yoksa 0). Koddan oku; 190'a açılış yazan bir yol varsa adıyla raporla.
 (3) MAHSUP EDİLMİŞ AYLAR: bütün aylar sırayla mahsup edilmişse zincir = defter = ön izleme (A = B) — DEĞİŞMEZ, testle. Bir ay mahsup edilmiş ama zincirin o aya getirdiği devreden defterdeki fişin kullandığından FARKLIYSA (önceki bir ay atlanıp sonraki mahsup edilmiş) rapor ZİNCİRİ gösterir ve özette not yazar: hangi ayın fişi hangi devredenle kesilmiş, zincire göre ne olmalıydı (iki sayı). Bu durumda ödenecek / devreden yönü değişiyorsa (defterde ödenecek yazılmış, zincire göre devreden ya da tersi) KODLAMA — 'KULLANICIYA SORULMALI'.
 (4) "Mahsup Edilmemiş Ay" notu KALIR; metni zincirli hesabı söyler (ör. "… için sayılar mahsup fişi sırayla kesilmiş gibi hesaplandı; ayları sırayla mahsup edin."). Cümle düzeninde.
 (5) Tur 1 raporu §8'in altı kararı KABUL: aralığın "Sonraki Döneme Devreden"i aralığın son ayının zincir sonucu; aralığın "Ödenecek KDV"si ayların ödeneceklerinin toplamı; ay satırları yalnız çok aylı aralıkta ve tam aylarda; üç sonuç satırı her zaman görünür; belgesiz tek ayda tablo boş, sayılar özette; not kalır.
 (6) KDV Mahsup Fişi ön izlemesi ve fişi bu turda da DEĞİŞMEZ (mahsupsuz ayda rapor ile ön izleme AYRIŞIR — not bunu söyler; ön izlemenin zincire uyması ayrı karar, raporda öner).
{KURALLAR_KULLANICI}

## İş
0. NASIL BOZULUR (rapor taslağının başına, koddan ÖNCE, commit): hiç mahsup fişi yok; ortada bir ay atlanmış; atlanan aydan SONRAKİ ay mahsup edilmiş (kopuk zincir — karar (3)); ödenecek aydan sonra yeniden devreden; mahsup fişi silinmiş / yeniden kesilmiş; yıl başını aşan aralık; verinin ilk ayından önce başlayan aralık; hareketsiz aylar; 190 açılışı; KDV İndirim Dönemi başka aya atılmış alış; iadeler, tevkifat; kilitli dönem; iki şirket; gelecek / boş dönem.
1. KOD: karar (1)–(6). A ↔ B tek yerde.
2. TESTLER (tur 1'in test dosyasına ek ya da yanına): S-M1-1 örneği (B sayıları 1.560 / 0 / 560; ELLE yazılı); hiç mahsup yok (üç dört aylık elle hesaplanmış zincir, arada ödenecek ay); kopuk zincir notu; karar (3) değişmezi (hepsi sırayla mahsup → rapor = ön izleme = 190, ay ay); mali müşavirin tur 1'deki beklentileri (Şubat 2.000 / 0 / 800; Mayıs 1.140 / 60 / 0; Eylül 2.000 / 0 / 1.960) AYNEN yeşil; ekran = PDF = Excel; tur 1 kodunda (taban t251-m1-tur1; AYRI kopya) yeni sınamalar BEKLENEN NEDENLE kırmızı (ör. Kasım 'önceki 1.960').
3. HIZ: KDV Özeti yıllık ve tek ay açılışı temiz 100 bin kopyasında tur 1 ↔ tur 2 (tur 1'in `olc-kdv.sh` betiği; ÖZEL kilit, yük > 2 ise GEÇERSİZ); tur 1'e göre %10'dan kötü değil. 100 bin verisinde (hiç mahsup yok) yıllık "Sonraki Döneme Devreden" sayısını raporda yaz ve elle bir ara ayla sağla.

## Kabul koşulları
A. `npm run test:kahin-defter` iki TZ — tur 1 ile AYNI. B. Tur 1'in bütün testleri + komşu listesi (`komsu.sh`) iki TZ yeşil; beklentisi değişen her test / ekran senaryosu KOŞULUR (ders 28). C. MUTANTLAR DEĞERLE (tur 1'in 10 mutantı + en az: mahsupsuz ayı zincirden atla; ödenecek aydan sonra devredeni taşı; zinciri aralığın ilk ayından başlat (öncesini unut); kopuk zincir notunu yazma; A ↔ B anahtarını ters çevir) — her biri en az bir testte kırmızı; mutantlar İKİ TZ'de.

## Dosya sınırı
Tur 1 ile aynı: `server/routes/report-center.mjs` (YALNIZ KDV Özeti raporu ve yardımcıları), `server/routes/tax.mjs` (yalnız rapora hesap veren işlevler; ön izlemenin / fişin davranışı AYNEN), testler + `test/fixtures/**`. Başka her dosya YASAK.

{kurallar('m1t2', taban="t251-m1-tur1")}

{rapor()}
"""

# ---------------------------------------------------------------- P-Ç5C (plan; kod yok)
PC5C = f"""Sen DestekOfis projesinde 2.5.1'in ÖDEME HATIRLATMA (Ç5-C) PLAN ajanısın (P-Ç5C; eforun high). KOD VE TEST YAZMAZSIN — yalnız belge. Amaç: WhatsApp Ödeme Hatırlatma'nın tutarı ve elemesi cari kartının tek borç sırasına (Gecikmiş Borç) geçmeden ÖNCE "kime kaç kez" ilkesini PLANDA yazmak (ders 45 — kullanıcı onaylayacak), bugünkü kodu okuyup değişecek her yolu çıkarmak ve kullanıcıya sorulması gereken her alt durumu TEK listede toplamak (TOPLU soru — sonradan tek tek soru çıkmasın). Devir işinin D6 parçası (Devri Geri Al / yedekten geri yükleme sonrası "kime kaç kez") da bu ilkeye bağlanır.

{hazirlik(kod=False)}
   Ayrıca oku: `docs/erp/C5-ACILIS-TASARIM.md` §2.10, §2.12, §8 (Ödeme Hatırlatma ve tek "gecikmiş" tanımı); `docs/erp/C5B-TYK-TASARIM.md` §1, §3; CLAUDE.md'deki WHATSAPP "KİME KAÇ KEZ" GENEL İLKESİ ve KULLANICI ONAYLI WHATSAPP DAVRANIŞLARI satırları + bunların `docs/GECMIS-KARARLAR.md`'deki tam metni (python ile satır satır ara: 'Arşiv 06.11.2026 (2)', '01.11 06:28', 'S9-1', 'S9-2'); `docs/2.5.0-IS-LISTESI.md` içinde şu kararların TAM metni (python ile 'S7', 'S16', 'S17', 'S22', 'S23', 'S29', 'S34', 'S67', 'S69', 'S93', 'S220', 'S260', 'B1-W', '22.11 06:32' geçen satırlar — dosya çok büyük, satırlar çok uzun: düzenli ifadeli grep TAKILIR, python ile oku ve yalnız ilgili parçayı yazdır); `docs/2.5.0-DEGISIKLIKLER.md`'de Ödeme Hatırlatma geçen BİLİNEN SINIR satırları; WhatsApp kâhininin karar belgesi (`test/bagimsiz/whatsapp-248/README.md` ve `kahin/` altındaki .md belgeleri — YALNIZ belge; model kodu OKUNMAZ, hiçbir kâhin dosyası YAZILMAZ); `docs/devir/D3-D4-TASARIM.md`'de WhatsApp / D6 geçen bölümler.
{KURALLAR_KULLANICI}

## İş (sırayla; her adım bitince commit)
1. BUGÜNKÜ DURUM (koddan; dosya:satır): Ödeme Hatırlatma'da (a) otomatik seçim kimi alıyor, hangi alanı okuyor (eski anlamdaki taksit gecikmişi), (b) iletideki {{{{3}}}} / {{{{4}}}} / {{{{5}}}} nereden geliyor, (c) elle seçim, (d) önizleme / Zaten Kuyrukta / dönem eşliği / Sonucu Belirsiz / Yine de Gönder, (e) gönderim ANINDA yeniden değerlendirme (kuyruktayken borç ödenirse, şüpheli kaydı açılırsa, cari silinirse / türü değişirse), (f) ekrandaki etiketler ("Şüpheli Alacağı Var" …), (g) aynı sayıyı okuyan öbür yerler (cari kartının taksit özeti, Mevcut Borç kartı açma sınırı — S260, Rapor Merkezi kolonları). Tek borç sırasının bugün verdiği alanlar (gecikmiş, en eski vade, şüphesiz gecikmiş, Ödeme Sözü durumu, cari türü) — hangisi HAZIR, hangisi eksik.
2. FARK TABLOSU (sayıyla; programın KENDİ ürettiği veride — `{SP}/ana-kabul` altındaki temiz büyük veri SALT OKUNUR, kopyasını kendi not defterine al; ya da küçük bir senaryoyu programın API'siyle kur): bugün seçilen ↔ tek borç sırasına göre seçilecek cari kümesi — yalnız taksidi gecikmiş / yalnız faturası gecikmiş / yalnız elle Borç Yaz'ı gecikmiş / kapatılmış kartın borçta kalanı (S220) / bakiyesi 0 ama eski anlamda gecikmiş görünen / tedarikçi / şüpheli / Ödeme Sözü olan. Her sınıf için "bugün gider mi → sonra gider mi → tutar bugün → tutar sonra". ALICI KÜMESİNİN BÜYÜMESİ kullanıcıya sayıyla gösterilecek ana değişikliktir.
3. İLKE TASLAĞI — `docs/devir/C5C-ILKE-TASLAK.md` (KULLANICI DİLİNDE; kısa cümle, madde, örnek sayı; dosya / alan adı YOK): başlıklar — Kime Gider · Kime Gitmez (etiketiyle görünür, istenirse elle seçilir mi) · Hangi Tutar ve Hangi Vade · Kaç Kez (dönem; genel ilkenin beş maddesiyle birebir) · Kuyruktayken Durum Değişirse (ödedi / söz verdi / şüpheliye alındı / tedarikçi oldu / silindi) · Elle Seçim ve Yine de Gönder · Sürüm Geçişi (2.5.0'da bu dönem hatırlatma almış cari 2.5.1'de daha büyük tutarla yeniden seçilir mi) · Devir, Devri Geri Al, Yedekten Geri Yükleme (D6) · İki Şirket. HER madde şu ikisinden biriyle işaretlenir: "KARARLI (karar no + AYNEN metin)" ya da "YENİ — KULLANICIYA SORULMALI (A / B (+ uç durumsa C: böyle kalsın) + öneri + örnek sayı; genel ilke tek okumaya izin veriyorsa 'İLKEYLE' ve hangi maddesiyle)". Son adayda yeni kural girmeyeceği için (ders 45) listeyi EKSİKSİZ tut: "nasıl bozulur?" listesini önce yaz, her satırını bir maddeye bağla.
4. PAKETLEME: WhatsApp kâhini bakımına girdi listesi (kural dilinde, kod adı yok — ana oturum karar girdisine çevirecek); kod turunun dosya sınırı ve sırası (D6 ile ilişkisi; aynı dosyaya dokunan öbür 2.5.1 işleri: müşteri isteklerinin cari listesi, devir); test planı ("nasıl bozulur?" → test; ders 20 zorla üretme, sahte Meta); hız bütçesi (ders 47: 2.000 cari önizleme ≤ 2 sn — bugünkü ölçümle); cari kartının taksit özeti ve S260'ın bu pakete girip girmeyeceği (öneri + gerekçe).

## Kurallar
- YAZABİLECEĞİN: yalnız `docs/devir/C5C-ILKE-TASLAK.md` ve `docs/devir/2.5.1-DEVAM/pc5c-*`. Kod, test, kâhin, iş listesi, CLAUDE.md YASAK.
- Gerçek dış servise İSTEK YOK (program açılacaksa `HUKUK_LICENSE_URL=http://127.0.0.1:9`, WhatsApp sahte uçla); müşteri verisi yok. Koşu yaparsan `flock -s -w 3600 {SP}/olcum.lock timeout -k 5 <sn>` altında; önce `cat /proc/loadavg` (4'ün üstündeyse tek seferlik bekle). Tam `npm test` YOK.
- Kararların söylemediği her "kime kaç kez" durumu baş mimarca KESİNLEŞTİRİLMEZ — soru olarak yazılır (ders 43, 45).

{kurallar('pc5c', kod=False)}

{rapor(kod=False)}
"""

# ---------------------------------------------------------------- M2 kod turu (Değersiz Alacak sınırı)
M2 = f"""Sen DestekOfis projesinde 2.5.1'in DEĞERSİZ ALACAK SINIRI KOD ajanısın (M2; eforun high). Para çekirdeğine dokunan dar bir düzeltme: 'Değersiz Alacak Yaz'ın üst sınırı, formun gösterdiği sınır ve fazla yazımı yakalayan değişmez. Bu aile 2.5.0'da iki kez gerileme verdi (ilk uygulama GERİ ALINDI) — bu yüzden kural ÖNCE kodu görmeyen kâhine yazıldı; senin kabul ölçütün kâhinin elle senaryosudur.

{hazirlik(taban="t251-m2-taban", taban_ne="çalışma dalı + cari kâhini bakımı 30")}
   Ayrıca oku (TAMAMI): karar girdisi `{ANA}/docs/devir/2.5.1-DEVAM/m2-kararlar.md` (kararlar AYNEN + baş mimar okuması + 14 senaryo sınıfı); 2.5.0'ın iki dar kontrol raporu `docs/devir/2.5.0-DEVAM/dk-ud3-rapor.md` ve `dk-ud4-rapor.md` (bulgular, örnek sayılar, betik adları — dk-ud4'ün min(...) önerisi bir ÖNERİDİR, kural değil); geri alınan uygulama `git show 7141a308` (yalnız NE YAPILMAMALI diye: sonradan gelen bağsız tahsilatta fazla yazıma izin veriyordu). İSTİSNA (bu görev için): kâhinin `test/bagimsiz/cari/senaryolar/d62-c5-m2-degersiz-siniri.json` senaryosunu ve `test/bagimsiz/cari/KARARLAR.md`'nin 'Bakım 30' bölümünü OKUYABİLİRSİN (beklenen sayılar ve kural yorumu orada); kâhinin model kodu OKUNMAZ, `test/bagimsiz/**` YAZILMAZ.

## Kararlar (AYNEN metinleri karar girdisinde; özet)
- S264 = A: Değersiz, yazıldığı günün faturaya bağlı payından ÖNCE değerlendirilir (o günün tarihiyle tam tutar).
- S269 = A: bu sınır 'kayıt kapalı' denetiminden ÖNCE uygulanır (Değersiz Yaz ve Silinenler'den geri yükleme); düğme bu kayıtlarda görünür.
- S268 = A: formun ipucu ve önerilen tutarı gerçek sınırı gösterir.
- S270 = A: hiçbir sırada bir kaydın Değersiz toplamı, şüpheliye alınan tutardan kayda düşmüş tahsilatlar çıkınca kalanı aşamaz; Değersiz yazımı cariyi eksi bakiyeye düşürmez.
- S-M2-1 = B (kullanıcı 27.11): aynı günün işlem sırası kuralı DEĞİŞMEZ; Değersiz kayıt gününün tarihiyle yazılırsa o günün bağlı payından önce, SONRAKİ tarihle yazılırsa önceki günlerin bağlı payı düşülmüş kalan kadar.
- SK-55 = C (kullanıcı 27.11): aynı gün 'bağlı tahsilat → bağsız tahsilat → Şüpheliye Al' sırasında payın ölçüm anı BİLİNEN SINIR — bugünkü davranışı DEĞİŞTİRME, raporda bugünkü sayıyı yaz.
- BAŞ MİMAR (kâhin Y30-6): ekranın önerdiği tutar HER ZAMAN kabul edilir → önerilen tutar = Değersiz sınırı ile bakiye kuralının (S155: kayıttan sonra carinin borcu açık şüphelinin altına düşemez) izin verdiğinin KÜÇÜĞÜ.
- EKRAN (karar girdisi §2 madde 5): form tarihi kendiliğinden geriye KURMAZ; ipucu seçili tarihin sınırını ve (farklıysa) kayıt gününün tarihiyle yazılabilecek tutarı birlikte söyler; tarih değişince ipucu ve önerilen tutar sunucudan yeniden okunur. Düğme, izinli (kilitli olmayan) tarihlerden herhangi birinde sınır > 0 ise görünür.
- KAPSAM DIŞI: aynı günün sıra kuralı (borç sırası ayırıcısı), Şüpheliden Çıkar, Karşılık Ayır (aynı sınıf ayrı karar bekliyor), defter kuralları.
{KURALLAR_KULLANICI}

## İş (sırayla)
0. NASIL BOZULUR + TASARIM (rapor taslağının başına, koddan ÖNCE, commit): karar girdisi §3'ün 14 sınıfı + dk-ud3 P1–P8 + dk-ud4 Q1–Q6 + F (iki kayıt) + Silinenler'den geri yükleme iki sırayla + bağlı tahsilatın Değersiz'den SONRA silinmesi / bağının kalkması / tarih ve tutar değişimi + Dönem Kilidi + iki şirket + yedekten geri yükleme. 'Tarih → sınır' hesabının TEK yerde nasıl kurulacağı (liste, Değersiz Yaz, geri yükleme, form AYNI işlevi okur — üç kopya formül YOK) ve bugünkü ayırıcının hangi çıktılarından türeyeceği; ayırıcıyı kaç kez koşturduğu (hız).
1. KOD: sınır işlevi + Değersiz Yaz + Silinenler'den geri yükleme + kayıt listesinin 'yazılabilir' alanı + form (ipucu, önerilen tutar, düğme). Ret iletileri: sınır aşımı iletisi gerçek sınırı ve nedeni söyler (dk-ud3 DÜŞÜK-1 ve dk-ud4 'breaks' iletisi — 'kalan şüpheli tutarı aşıyor' diyen yanıltıcı metinler düzelir); bildirimde 'şüphelide kalan' sayısı bu yazımdan sonraki gerçek kalan.
2. DEĞİŞMEZ: mutabakat denetimine (kapı + Mutabakat Testi) 'her şüpheli kayıt için Değersiz toplamı ≤ alınan − kayda düşen tahsilat' ve 'Değersiz yazımı bakiyeyi eksiye düşürmez' — geri alınan uygulamanın ürettiği durum (Değersiz 3.000, bakiye −576,45) bu denetimde YAKALANMALI (bozuk durumu teste SQL ile kurup denetimin yakaladığını göster).
3. TESTLER: karar girdisi §3'ün her sınıfı API'den (sayılar yanıt gövdesi + veri tabanından; kâhinin d62 beklenenleriyle AYNI — farklıysa DUR, raporda 'KÂHİNLE AYRIŞMA'); eski sürüm karşılaştırması KALICI testte (ders 53 (b)): v2.4.9'un gerçek koduyla aynı senaryolar — v2.4.9 ile AYNI olması gereken sınıflar (tam tutar, kısmi zincir, sonradan bağsız → 2.000) ve S-M2-1 = B yüzünden BİLEREK farklı olanlar (sonraki tarihli yazım) karar numarasıyla 'beklenen farklar' listesinde; rastgele sıra testi (tohumlu): her adımda değişmez + 'ekranın önerdiği tutar ve tarih kabul edilir'. Ekran senaryosu: gerçek tıklama + Tab + insan hızında yazım (ders 12) — önerilen tutarla yazım, tarih değiştirince ipucunun değişmesi, kısmi yazımdan sonra kalanın yazılması, fazla yazımın reddi; kayıttan sonra sayılar veri tabanından.
4. KÂHİN ↔ PROGRAM: `npm run test:kahin-cari` iki TZ — bugün yeni elle senaryoda 52 fark 'yapım aşaması' listesinde; senin kodunla bu 52 kaydın HEPSİ kapanmalı (listeyi SEN yeniden yazma — `test/bagimsiz/**` yasak; koşunun çıktısından 'yapım aşaması kaydı olup artık TUTAN' sayısını oku ve raporla; ana oturum listeyi yeniden üretir). Öbür senaryolarda yeni fark 0.
5. HIZ (ders 47, 53 (a)): Değersiz Yaz, şüpheli kayıt listesi, cari kartı ve Silinenler'den geri yükleme — temiz 100 bin kopyasında (`{SP}/ana-kabul/temiz-100k` SALT OKUNUR; kopyasını kendi klasörüne al; şüpheli kaydı olan carilerle) taban ↔ yeni, özel kilit (`flock -x -w 1800 {SP}/olcum.lock`), yük > 2 ise GEÇERSİZ; %10'dan kötü olmaz. Kilit alınamazsa 'ölçülemedi' yaz — bekleme döngüsü kurma.

## Kabul koşulları
A. Kâhin: iş 4. B. Yeni testler eski kodda (taban) beklenen nedenle kırmızı, yenide yeşil, iki TZ; komşular (`git grep` ile: şüpheli / Değersiz / mutabakat kapısı / cari kartı / Silinenler testleri + şema kapısı ve geri yükleme testleri — ders 10) iki TZ yeşil; `npm run test:kahin-defter` taban = yeni. C. MUTANTLAR (değerle; ayrı kopya): sonradan gelen bağsız sınırı küçültmesin; sonraki tarihli Değersiz satırı sayılmasın; önceki günün bağlı payı düşülmesin; o günün bağlı payı Değersiz'den önce düşülsün; değişmez denetimi atlansın; önerilen tutar bakiye sınırını bilmesin; geri yükleme sınırı atlasın; form eski 'kalan'ı göstersin — her biri en az bir testte kırmızı. D. Beklentisi değişen her test / ekran senaryosu KOŞULUR (ders 28).

## Dosya sınırı
`server/lib/bank/doubtful.mjs`; şüpheli kayıt uçlarının bulunduğu rota dosyası (yalnız Değersiz Yaz / geri yükleme / liste alanı); mutabakat denetiminin dosyası (yalnız yeni değişmez); `client/assets/hof-accounts.js` (yalnız Değersiz formu ve düğmesi) + gerekiyorsa `hof-ui.css`; testler + `test/fixtures/**`. Borç sırası ayırıcısı (`server/lib/obligation-queue.mjs`), defter, Rapor Merkezi, WhatsApp, devir kodu YASAK — gerekiyorsa DUR, 'BAŞ MİMAR KARARI GEREKİYOR'.

{kurallar('m2', taban="t251-m2-taban")}

{rapor()}
"""

out = os.path.dirname(os.path.abspath(__file__))
# ---------------------------------------------------------------- D3 TUR 2 (27.11; tur 1'in eksik testleri + doğrulanmamışları + gerçek veri kapsamı)
D3T2 = f"""Sen DestekOfis projesinde 2.5.1'in D3 TUR 2 KOD ajanısın (devir: SAF HESAP + DEVİR RAPORU + ÖN DENETİM; PARA ÇEKİRDEĞİ; eforun high). Tur 1 başka bir ajanla bitti (dal ucu etiketi t251-d3-tur1); sen temiz bağlamla YALNIZ aşağıdaki işleri yaparsın (ders 46). D3 hâlâ HİÇBİR ŞEY YAZMAZ (yalnız plan + ön izleme). Bu turun amacı YENİ ÖZELLİK DEĞİL: tur 1'in kendi raporunda 'testi yazılmadı' / 'DOĞRULANMADI' dediği sınıfları kapatmak ve gerçek veri kapsamını genişletmek — hata çıkarsa düzeltmek.

{hazirlik(taban="t251-d3-tur1", taban_ne="D3 tur 1'in dal ucu (e1a6f263)")}
3. Sonra oku: `docs/devir/2.5.1-DEVAM/d3-rapor.md` (tur 1'in raporu — TAMAMI: nasıl bozulur tablosu, plan biçimi §12, D4a eşlemesi §13, DOĞRULANMADI, DENENMEYEN), tur 1'in görev metni `{ANA}/docs/devir/2.5.1-DEVAM/d3-istem.txt` (kararlar ve dosya sınırı AYNEN geçerli), tasarım `{ANA}/docs/devir/D3-D4-TASARIM.md` (§3 TAMAMI, §4.4), tur 1'in kodu (`git diff t251-taban..t251-d3-tur1 -- server test`) ve kanıt açıklaması `docs/kanit/2026-11-27/d3-OKU-BENI.txt`.

## Kararlar
Tur 1 görev metnindeki BÜTÜN kararlar (kullanıcı kararları, S-1 / S-2 / S-3 = A, baş mimar kararları (1)–(5)) AYNEN geçerli.
KULLANICI 27.11 (AYNEN: "1 ajan sürekli devir zincirinin işini yapsın, maş mimar olarak senin içinde uygunsa") — devir zinciri ara vermeden sürer; bu tur o zincirin sıradaki adımıdır.
BAŞ MİMAR KARARLARI 27.11 (tur 1 raporunun BM maddeleri üzerine; kullanıcıya gösterildi, değiştirebilir):
 BM-1 (şüpheli carinin devir 'Alacak Toplamı' satırı): DOKUNMA — kodu görmeyen kâhinin sonucu bekleniyor; davranışı DEĞİŞTİRME, yalnız testle SABİTLE (bugünkü sayılar elle yazılı) ki sonradan karar değişirse tek yerden değişsin.
 BM-3 (ön denetimde tam Mutabakat Testi yerine Defter Mutabakatı DURDURUR): KABUL — değişmez.
 BM-4 (şirket kapanırken ön izleme iş parçacığı): bu turda YOK (devri uygulayan pakette bağlanacak).
 BM-6 (ödeme rolündeki açık kalem yeni yılda ÖDEME satırı olarak yazılır, vadesini ASIL tarihten alır): planın bu satırı yazmaya yetecek alanları taşıdığını (rol, asıl tarih, tutar, karşı kalem) testle SABİTLE; eksik alan varsa ekle ve raporda plan biçimi farkını yaz.
 BM-7 (sonucun boyu): bu turda YOK.
 H-1 (hız bütçesi): KARAR KULLANICIDA — tek borç sırasına ve devrin hız yoluna KOD DEĞİŞİKLİĞİ YOK. Yalnız İNCELEME (iş 5).
{KURALLAR_KULLANICI}

## İş (her adım bitince commit)
0. NASIL BOZULUR (rapor taslağının başına, koddan ÖNCE, commit): aşağıdaki her sınıf için 'ne ters giderse devirli ≠ devirsiz olur' listesi; tur 1'in 42 maddelik tablosundan bu tura düşenler numarasıyla.
1. TUR 1'İN 'TESTİ YAZILMADI' DEDİĞİ DÖRT SINIF (elle hesaplanmış küçük senaryolar — beklenen sayılar testte ELLE yazılı; her birinde devirsiz eşdeğer de):
 (a) K'den SONRA yazılmış, K'den ÖNCEKİ belgeye bağlı kayıt (tahsilat / ödeme / mahsup / iade) — planın bağ yönlendirmesi: bağ yeni yıldaki hangi açılış kalemine gider, tutarlar, kısmi bağ, bağın karşı tarafı da K'den önceyse / sonraysa.
 (b) EVRAKIN K'DEKİ DURUMU: çek ve senet, alınan ve verilen; K gününde portföyde / ciro edilmiş / tahsile ya da teminata verilmiş / vadesi K'den sonra / K'den önce ödenmiş ya da tahsil edilmiş / karşılıksız ya da protestolu / K'den SONRA durumu değişmiş (plan K'deki durumu taşımalı) — koddaki bütün durumları tara, her durum en az bir satır.
 (c) Alt hesaplı öbür hesaplar: kredi kartı / POS alacağı / banka kredisi gibi cari ve banka dışındaki alt defterli hesapların açılışları (tur 1 raporunda numaralarıyla); her birinin kapanış = açılış değişmezi.
 (d) Şablonlar ve e-Belge olguları: okuyucunun bu tabloları doğru okuduğu (yinelenen işlem şablonu, gönderilmemiş / iptal bekleyen e-Belge, numara sayaçları) — ön denetim maddeleri yalnız olgu düzeyinde değil GERÇEK veri tabanından okunarak.
2. TUR 1'İN 'DOĞRULANMADI' MADDELERİ (her biri için senaryo + sonuç; hata ise düzelt, para kuralı ayrışması ise KODLAMA — SORULMALI):
 (e) K'den sonra faturaya bağlı tahsilatı olan şüpheli cari: planın K'deki şüpheli payı doğru mu; plan yanlışlıkla DURDURUYOR mu (yanlış durdurma da hatadır — kullanıcı devir yapamaz).
 (f) K'den SONRA 'Borçta Kalsın' ile kapanan taksit kartı: taksit vadeleri devirli ↔ devirsiz aynı mı (gecikmiş, kalan, vade listesi).
 (g) Dönem Kilidi: kilit K'yi kapsıyorken / K'den önceyken / hiç yokken plan; kilit geçmişine dokunulmadığı.
 (h) Evrak durum sınıfları (b ile birlikte) ve K günü ile K+1 günü yazılmış aynı tutarlı iki kayıt.
3. GERÇEK VERİ KAPSAMI (ders 17; tur 1'in üreteci yalnız fatura / tahsilat / ödeme / stok üretiyordu): `test/devir-d3-gercek-veri.mjs` üretecine v2.5.0'ın GERÇEK kodunun API'siyle şunlar eklenir — taksit kartı (açık, bitmiş, Borçta Kalsın ile kapanmış, erken kapatılmış), çek ve senet (yukarıdaki durumlar), şüpheli alacak (Şüpheliye Al, kısmi ve tam Değersiz, Şüpheliden Çıkar, Karşılık), KDV mahsup fişi (bazı aylar kesilmiş, bazıları atlanmış), vergi ödemesi, banka hareketleri (havale / EFT, POS, kredi kartı, virman), iade faturaları, silinmiş ve geri yüklenmiş kayıt, pasif cari, aynı adlı iki cari. Her isteğin yanıt kodu okunur (ders 3: reddedilen istek veri üretmez — üretilen her sınıfın SAYISI rapora). Üç tohum × iki TZ; her koşuda devirsiz eşdeğer 0 fark ve bütün değişmezler. Fark çıkarsa: yeniden üret, kök neden (ders 6); plan hatasıysa düzelt + o sınıf için elle sayılı KÜÇÜK test (kalıcı); kural ayrışmasıysa SORULMALI. `--veri` seçeneği (hazır veriyi yeniden kullanma) eklenebilir.
4. MUTANTLAR: tur 1'in 15 mutantı AYNEN yakalanır + bu turun her sınıfı için en az bir yeni mutant (bağ yönlendirmesi, evrak durumu, alt hesap açılışı, şüphelinin K payı, kart vadesi, kilit) — her biri en az bir testte kırmızı.
5. HIZ İNCELEMESİ (KOD DEĞİŞİKLİĞİ YOK; karar için sayı): temiz 100 bin kopyasında (`{SP}/ana-kabul/temiz-100k` OKUNUR; KENDİ kopyan) ön izlemenin en pahalı bileşeni olan tek borç sırası çağrısının İÇİNDE sürenin nereye gittiğini ölç (hangi adım kaç sn; devrin ihtiyaç duymadığı hangi hesaplar yapılıyor) ve 'devre özel dar kip' yazılsa beklenen kazancı SAYIYLA tahmin et; ayrıca tek borç sırasını DEĞİŞTİRMEDEN devir tarafında yapılabilecek kazançları (aynı çağrının yinelenmesi, gereksiz ikinci okuma) listele. ÖZEL kilit `flock -x -w 1800 {SP}/olcum.lock` tek seferlik (alamazsan 'ÖLÇÜLEMEDİ' — yük altında gösterge ayrıca, GEÇERSİZ diye işaretli); /proc/loadavg yazılır.

## Kabul koşulları
A. `npm run test:kahin-defter` ve `npm run test:kahin-cari` iki TZ — tur 1 ile AYNI. B. Tur 1'in BÜTÜN testleri + komşu listesi iki TZ yeşil. C. Mutantlar (iş 4) iki TZ. D. Gerçek veri: üç tohum × iki TZ, 0 fark; üretilen sınıf sayıları tabloda. E. Bu turun testlerinden tur 1 kodunda (taban t251-d3-tur1; AYRI kopya) KIRMIZI olanlar = bulduğun hatalar (nedenleriyle); tur 1 kodunda da yeşil olanlar 'yeni sınıf testi — dişi mutasyonda' diye AYRI listelenir (kırmızı kanıt diye yazılmaz — ders 7, 38).

## Dosya sınırı
Tur 1 ile aynı: `server/lib/devir/` altındaki D3 modülleri (plan, okuyucu, ön denetim, rapor, iş parçacığı), `server/routes/devir.mjs` (yalnız ön izleme uçları), `test/devir-d3-*` + `test/fixtures/**`. OKUR, DEĞİŞTİRMEZ: tek borç sırası, mali tablo hesabı, stok değerlemesi, defter türetmesi, D2 modülleri, şüpheli / evrak / kart modülleri. YASAK: istemci, göçler, `server/app.mjs`, KDV mahsup hesabı ve Rapor Merkezi, Cari ekranı, `test/bagimsiz/**`. Sınır dışında hata bulursan DÜZELTME — raporda 'BAŞ MİMAR KARARI GEREKİYOR' (yeniden üretim betiğiyle).

{kurallar('d3t2', taban="t251-d3-tur1")}

{rapor()}
Ek olarak raporda: tur 1'in DOĞRULANMADI / DENENMEYEN listesinin madde madde SON durumu (kapandı / hata bulundu ve düzeltildi / hâlâ açık + neden); plan biçiminde tur 1'e göre DEĞİŞEN alanlar (sürücü ajanı ve D4a için); gerçek veride üretilen sınıf sayıları; hız incelemesi tablosu.
"""

# ---------------------------------------------------------------- D3 TUR 3 (27.11; devir yeri — üç devir kararı + DEVİR NEDEN DURDU)
D3T3 = f"""Sen DestekOfis projesinde 2.5.1'in D3 TUR 3 KOD ajanısın (devir: SAF HESAP + DEVİR RAPORU + ÖN DENETİM; PARA ÇEKİRDEĞİ; eforun high). Tur 1 ve tur 2 başka ajanlarla bitti (tur 2'nin dal ucu etiketi t251-d3-tur2); sen temiz bağlamla YALNIZ aşağıdaki işleri yaparsın (ders 46). D3 hâlâ HİÇBİR ŞEY YAZMAZ (yalnız plan + ön izleme + ön denetim + Devir Raporu). Bu tur: kullanıcının üç devir kararının kodu + 'devir neden durdu' iletileri (hesap / ön izleme / ön denetim / Devir Raporu tarafı) + tur 2'nin açık bıraktıkları.

{hazirlik(taban="t251-d3-tur2", taban_ne="D3 tur 2'nin dal ucu")}
3. Sonra oku: `docs/devir/2.5.1-DEVAM/d3t2-rapor.md` (tur 2'nin raporu — TAMAMI; özellikle 'hâlâ açık', DOĞRULANMADI, DENENMEYEN, plan biçimi farkları), `docs/devir/2.5.1-DEVAM/d3-rapor.md` (tur 1'in raporu: nasıl bozulur tablosu, plan biçimi §12, D4a eşlemesi §13), tur 1 ve tur 2'nin görev metinleri `{ANA}/docs/devir/2.5.1-DEVAM/d3-istem.txt` ve `d3t2-istem.txt` (kararlar ve dosya sınırı AYNEN geçerli — aşağıdaki EK dışında), tasarım `{ANA}/docs/devir/D3-D4-TASARIM.md` (§3 TAMAMI, §4.4), önceki turların kodu (`git diff t251-taban..t251-d3-tur2 -- server test`).

## Kararlar
Tur 1 ve tur 2 görev metinlerindeki BÜTÜN kararlar (kullanıcı kararları, S-1 / S-2 / S-3 = A, baş mimar kararları, BM-1 / BM-3 / BM-4 / BM-6 / BM-7, H-1) AYNEN geçerli. H-1 (hız bütçesi) KARARI HÂLÂ KULLANICIDA: tek borç sırasına ve devrin hız yoluna KOD DEĞİŞİKLİĞİ YOK.
KULLANICI 27.11 (AYNEN: "1 ajan sürekli devir zincirinin işini yapsın, maş mimar olarak senin içinde uygunsa") — bu tur devir zincirinin sıradaki adımıdır.
KULLANICI KARARI 27.11 11:39 UTC (AYNEN: "devir yapılırken bir sebeple duruyorya, nedenini kullanıcıya açıkça türkçe yazsın program, önerilerine ek olarak bunuda uygula."). Bu iletiyle üç devir sorusu ÖNERİYLE yanıtlandı (soruların tam metni aşağıda AYNEN):
 S-KD-1 = A. Soru: S-3 = A "düzeltilmemiş Kural Değişikliği Farkı varken devir durur" kararında, geriye YALNIZ düzeltme fişinin düzeltemediği alt defter farkı kaldıysa (örnek: aynı caride müşteri hesabı +4.000 / şüpheli hesabı −4.000; toplam 0)? A (SEÇİLEN): devir yine DURUR; "Kilidi Aç → Yeniden Kilitle" ile fark temizlenince geçer (S-3 = A ile aynı çizgi; çaresi var).
 S-KD-2 = A. Soru: Dönem Kilidi tam kesim gününe (31.12) dayanmışken çıkan kural farkının düzeltme fişi kilit yüzünden 01.01'e düşüyorsa (örnek 3.000 TL)? A (SEÇİLEN): devir DURUR; kilit geri alınır, fiş eski yılın içinde yazılır, eski yılın kârı 3.000 azalır (fark ait olduğu yılda).
 S-KD-3 = B. Soru: Excel'den yüklenen taksit kartının Kayıt Tarihi kesim gününden ÖNCE, yükleme anı kesim gününden SONRA ise (örnek: Kayıt Tarihi 20.12.2026, yükleme 03.01.2027, kart 9.000; sonra 31.12.2026 kesimli devir)? B (SEÇİLEN): kart ve defter maddesi Kayıt Tarihi'ne göre ESKİ yıla sayılır; yeni yıla devir açılışıyla 9.000 gelir (programdaki öbür kayıtlar gibi tarih esas alınır, yükleme anı değil).
TUR 2 RAPORU ÜZERİNE BAŞ MİMAR KARARLARI (27.11; kullanıcıya gösterildi, değiştirebilir): BM-T2-1 ve BM-T2-2 (açık fatura kaleminin K sonrası bağların tutunabileceği biçimde yazılması; devir satırlarının (vade, belge tarihi) sırasıyla yazılması) → devri UYGULAYAN paketin (D4a) ŞARTI — bu turda YOK. BM-T2-3 (K'den sonra Borçta Kalsın ile kapanan kartta taksit vadesi MIN(asıl vade, kapanış günü); plan devirsiz programla aynı) → KABUL, değişmez. BM-T2-4 (test serili gönderilmemiş K öncesi belge devri 'Gönderilecek' diye durdurur) → durdurmaya DEVAM; iş 2'nin iletisinde NE YAPMALI kısmı belgeyi göndermeyi, iptal etmeyi ya da Durum Sorgula'yı adım adım söyler. S-T2-1 (K'den sonra yapılan Mahsup Et'in karşı belgesi K'den önceki alış faturasıysa — PARA / KAPAMA KURALI, ders 43) → KULLANICIYA SORULDU, yanıt BEKLENİYOR: bu turda KODLAMA; tur 2'nin o testindeki sabit sayılara DOKUNMA.
DEVİR NEDEN DURDU — aynı iletinin (II) kısmı; BAŞ MİMAR OKUMASI (kullanıcıya gösterildi; DEĞERLENDİR — karar metnine uyuyor mu; uymuyorsa ya da iki okuma çıkıyorsa raporda SORULMALI): (a) kapsam devri durduran HER neden — ön denetimin durduran maddeleri, hesap sırasında çıkan tutarsızlık, devri uygularken çıkan hata (yarıda kesilme, kilitli dosya, yer yok), Devri Geri Al / Devri Yenile redleri; (b) her nedenin iletisi dört şeyi söyler: NE oldu (hangi kayıt / cari / tutar / tarih — sayıyla), devir NEDEN duruyor, NE YAPMALI (adım adım; ör. "Kilidi Aç → Yeniden Kilitle"), NEREYE gidilecek (ekran adı; mümkünse kayda götüren bağlantı); (c) iç kod, İngilizce ileti, "bilinmeyen hata" gösterilmez — beklenmeyen hata da Türkçe cümleyle + "veriniz değişmedi" güvencesiyle (gerçekten değişmediyse) yazılır; (d) birden çok neden varsa HEPSİ birlikte listelenir (kullanıcı tek tek düzeltip yeniden denemek zorunda kalmasın); aynı liste Devir Raporu'nda (PDF / Excel) da yer alır; (e) uyarılar (durdurmayan) ayrı başlıkta, durduranlarla karışmaz; (f) kanıt: her durdurma nedeninin Türkçe cümlesi olduğunu denetleyen kalıcı test + ekran senaryosu + ana oturumun ekran yürüyüşü (cümle gerçekten anlaşılır mı — okunarak). UYGULAMA SIRASI: hesap / ön izleme tarafındaki nedenler ve üç kararın kodu → BU TUR; uygulama sırasındaki durmalar (yarıda kesilme, kilitli dosya, yer yok) ve Devri Geri Al / Devri Yenile redleri → devri uygulayan paket (D4) — bu turda YOK, ama iletinin biçimi (aşağıda iş 2) onların da kullanacağı TEK yardımcıda kurulur; ekran → sihirbaz paketi (D5) — bu turda istemci YOK.
{KURALLAR_KULLANICI}

## İş (her adım bitince commit)
0. NASIL BOZULUR (rapor taslağının başına, koddan ÖNCE, commit): üç karar ve ileti düzeni için 'ne ters giderse kullanıcı yanlış yönlenir / devir yanlış geçer / yanlış durur' listesi (yanlış DURDURMA da hatadır — kullanıcı devir yapamaz).
1. ÜÇ KARARIN KODU (her biri: elle hesaplanmış küçük senaryo, beklenen sayılar testte ELLE yazılı; devir geçiyorsa devirsiz eşdeğer de):
 (S-KD-1) Ön denetim düzeltilmemiş kural farkını TOPLAMDAN değil ALT DEFTER düzeyinde (cari başına, alt hesap başına) arar: toplamı 0 olan ama alt defterde +4.000 / −4.000 kalan fark da DURDURUR; ileti çareyi söyler ("Kilidi Aç → Yeniden Kilitle"); çare uygulandıktan sonra (testte gerçek API yoluyla) devir GEÇER. Fark hiç yokken durdurmadığı ayrıca.
 (S-KD-2) Dönem Kilidi tam kesim gününde (K) iken çıkan kural farkının düzeltme fişi kilit yüzünden K+1'e düşecekse ön denetim DURDURUR; ileti: kilidi geri al → düzeltme fişini eski yılın içinde yaz → yeniden kilitle (fişin tutarı ve eski yılın kârına etkisi sayıyla). Kilit K'den ÖNCE / K'de / hiç yokken üç sınıf; fiş eski yıla yazılınca devir geçer ve eski yılın kârı fişin tutarı kadar değişmiş görünür.
 (S-KD-3) Excel'den yüklenen taksit kartı Kayıt Tarihi'ne göre: Kayıt Tarihi K'den önce, yükleme anı K'den sonra → kart ve defter maddesi ESKİ yıla sayılır, plan yeni yıla AÇILIŞ olarak taşır (örnekteki 9.000). ÖNCE ÖLÇ: program bugün bu kartın defter maddesini hangi tarihle yazıyor (veri tabanından ve defter türetmesinin çıktısından OKU; v2.5.0 gerçek koduyla da). (i) Kayıt Tarihi ile yazıyorsa: yalnız plan / okuyucu tarafı + test. (ii) Yükleme anıyla yazıyorsa düzeltme defter türetmesindedir (dosya sınırı dışı) → aşağıdaki EK İZİN; elle yazılmış kart ve tablodan / Excel'den gelen kart arasında sonuç aynı olmalı. Kayıt Tarihi K'den sonra olan kart yeni yılda kalır (sınır testi: K günü, K+1 günü).
 (S-C5C-9 eki) Ödeme Hatırlatma ilke taslağı ONAYLANDI (kullanıcı 27.11 12:01 UTC, AYNEN: "ÖNERİLERİNİ UYGULA"; `{ANA}/docs/devir/C5C-ILKE-TASLAK.md` §8.1 — YALNIZ o madde): S-C5C-9 = A — devir başlarken o şirketin süren ve duraklatılmış toplu (WhatsApp) işleri "Durduruldu (Devir)" olur (bunu devri UYGULAYAN paket yapar — bu turda YOK). BAŞ MİMAR EKİ (kullanıcıya gösterildi): devrin ön denetiminde UYARI (DURDURMAZ) — "N kişilik gönderim durdurulacak" (kaç iş, kaç kişi; süren / duraklatılmış / sınır nedeniyle bekleyen; sayılar o şirketin gönderim kuyruğundan OKUNARAK — kuyruk modülü OKUR, DEĞİŞTİRMEZ). İş 2'nin ileti düzeniyle, 'Uyarılar' başlığında; iş yokken uyarı yok. Test: süren iş / duraklatılmış iş / hiç iş yok / öbür şirketin işi (sayılmaz).
2. DEVİR NEDEN DURDU — İLETİ DÜZENİ (TEK yardımcı; D4 / D5 de kullanacak): her durdurma nedeni dört alanlı bir ileti üretir: NE OLDU (kayıt / cari / tutar / tarih — gerçek değerlerle; tutar Türk para biçiminde, tarih gün.ay.yıl), NEDEN DURUYOR, NE YAPMALI (adım adım), NEREYE (programdaki ekran / pencere adı YAZIM DÜZENİ'yle; kayıt varsa kayda götürecek kimlik ayrı alanda). İç kod makine alanı olarak kalabilir ama kullanıcıya giden metinde GÖRÜNMEZ. İngilizce sözcük, alan adı, 'undefined' / 'null' / 'NaN' / '[object' / yığın izi YOK. Ön denetim İLK durdurmada kesilmez: BÜTÜN durdurma nedenleri birlikte listelenir; uyarılar (durdurmayan) ayrı listede. Ön izleme uçlarının beklenmeyen hatası da Türkçe cümle + "Verileriniz değişmedi." (D3 yazmadığı için doğru) — ham hata iletisi yanıt gövdesine girmez (sunucu günlüğüne gider). Devir Raporu'nda (ekran verisi + PDF + Excel; ekran = PDF = Excel) 'Devri Durduran Nedenler' ve 'Uyarılar' iki ayrı başlık, aynı cümlelerle.
 Kapsam taraması: ön denetimin, planın ve ön izleme uçlarının durdurma / hata üreten BÜTÜN yollarını `git grep` ile çıkar (tablo rapora); her yol bu yardımcıdan geçer.
3. KALICI İLETİ TESTİ: (a) her durdurma nedeni için onu GERÇEKTEN tetikleyen senaryo (API yoluyla kurulmuş veri) → dört alan dolu, değerler veriyle aynı (ör. ilette yazan tutar = veri tabanındaki tutar), yasak kalıplar yok; (b) iki ve daha çok neden aynı anda → hepsi listede, sıra kararlı; (c) uyarı ↔ durdurma ayrımı; (d) kaynak tarayan denetim: yardımcıyı atlayıp ham metin / İngilizce ileti üreten yeni bir durdurma yolu eklenirse kırılır (`/\\r?\\n/` — ders 27); (e) Devir Raporu'nun PDF ve Excel çıktısında aynı cümleler.
4. İLETİ KATALOĞU (ana oturum ve kullanıcı OKUYACAK): testin ÜRETTİĞİ gerçek iletilerden (elle yazılmış değil) `docs/devir/2.5.1-DEVAM/d3t3-iletiler.md` — her neden için bir örnek: dört alan, hangi senaryodan çıktığı. Cümleler kısa, kullanıcı dilinde, muhasebe terimi gerekiyorsa ekrandaki adıyla.
5. TUR 2'NİN AÇIK BIRAKTIKLARI: tur 2 raporundaki 'hâlâ açık' / DOĞRULANMADI maddelerinden BU DOSYA SINIRINDA kapanabilenler (her biri: senaryo + sonuç; hata ise düzelt, para kuralı ayrışması ise KODLAMA — SORULMALI). Sınır dışındakiler raporda gerekçesiyle.
6. MUTANTLAR: önceki turların mutantları AYNEN yakalanır + bu turun her kararı ve ileti düzeni için en az bir yeni mutant (alt defter farkını toplamdan arama, kilidin K'de olduğunu görmeme, Kayıt Tarihi yerine yükleme anı, ilk durdurmada kesme, ilette yanlış tutar, uyarıyı durdurma sayma) — her biri en az bir testte kırmızı.
7. GERÇEK VERİ (ders 17): tur 2'nin üreteci üç tohum × iki TZ yeniden koşulur — 0 fark ve bütün değişmezler AYNEN; ayrıca üretece Excel'den yüklenmiş taksit kartı (Kayıt Tarihi K'den önce, yükleme K'den sonra) ve kural farkı sınıfları eklenir (v2.5.0'ın GERÇEK koduyla; yanıt kodları okunur — ders 3).

## Kabul koşulları
A. `npm run test:kahin-defter` ve `npm run test:kahin-cari` iki TZ — tur 2 ile AYNI (EK İZİN kullanıldıysa farklar madde madde ve hangi karardan çıktığıyla; açıklanmamış fark YOK). B. Tur 1 + tur 2'nin BÜTÜN testleri + komşu listesi iki TZ yeşil. C. Mutantlar (iş 6) iki TZ. D. Gerçek veri: üç tohum × iki TZ, 0 fark. E. Bu turun testleri tur 2 kodunda (taban t251-d3-tur2; AYRI kopya) BEKLENEN NEDENLE kırmızı (karar kodu yok / ileti düzeni yok); tur 2 kodunda da yeşil olanlar AYRI listelenir. F. İleti kataloğu dosyası testin çıktısından üretilmiş ve commit'li.

## Dosya sınırı
Tur 1 / tur 2 ile aynı: `server/lib/devir/` altındaki D3 modülleri (plan, okuyucu, ön denetim, rapor, iş parçacığı) + yeni ileti yardımcısı (aynı klasörde), `server/routes/devir.mjs` (yalnız ön izleme uçları), `test/devir-d3-*` + `test/fixtures/**`. OKUR, DEĞİŞTİRMEZ: tek borç sırası, mali tablo hesabı, stok değerlemesi, D2 modülleri, şüpheli / evrak / kart modülleri, Dönem Kilidi modülü. YASAK: istemci, göçler, `server/app.mjs` (bağlama satırı dışında), KDV mahsup hesabı ve Rapor Merkezi, Cari ekranı, `test/bagimsiz/**`.
EK İZİN (YALNIZ S-KD-3 (ii) çıkarsa): defter türetmesinde Excel'den / tablodan yüklenen taksit kartının defter maddesinin TARİH SEÇİMİ — başka hiçbir şey; AYRI commit (iletisinde 'S-KD-3'); komşuları (o yardımcıyı ve o tarihi okuyan her yol: Excel / Sheets yükleme, taksit kartı ekranı, cari ekstresi, mizan / KDV, geri yükleme — `git grep` taramasıyla; ders 9, 10) iki TZ; v2.5.0 verisiyle göç / açılış karşılaştırması (eski veride hangi kayıtların yılı değişir — SAYIYLA rapora; bu bir para görünümü değişikliğidir, kullanıcı B ile onayladı). Sınır dışında başka hata bulursan DÜZELTME — raporda 'BAŞ MİMAR KARARI GEREKİYOR' (yeniden üretim betiğiyle).

{kurallar('d3t3', taban="t251-d3-tur2")}

{rapor()}
Ek olarak raporda: İLETİ KATALOĞU'nun yolu ve neden sayısı; durdurma / hata yolları tarama tablosu (yol → yardımcıdan geçiyor mu); S-KD-3 ölçümünün sonucu ((i) mi (ii) mi; v2.5.0 gerçek koduyla); tur 2'nin açık listesinin madde madde SON durumu; plan biçiminde tur 2'ye göre DEĞİŞEN alanlar (sürücü ajanı ve D4a için); D4 / D5'in bu yardımcıyı nasıl kullanacağı (kısa).
"""

# ---------------------------------------------------------------- D4-ÖN TUR 2 (27.11; Windows kırmızısı)
D4ONT2 = f"""Sen DestekOfis projesinde 2.5.1'in D4 ÖN KOŞULLARI TUR 2 KOD ajanısın (eforun high). Tur 1 başka bir ajanla bitti ve ana dalda (birleşim b0895406); sen temiz bağlamla YALNIZ aşağıdaki Windows kırmızısını çözersin (ders 46). Kapsam DARALTILMIŞTIR: yeni özellik yok.

{hazirlik(taban="t251-d4on-t2-taban", taban_ne="çalışma dalının ucu (devir ön koşulları ana dalda)")}
3. Sonra oku: tur 1'in testi `test/devir-d4on-yedek-tasima-251.test.mjs` ve değiştirdiği ürün kodu (`git show b0895406 --stat`; `git diff 64396478 fce0e31f -- server`), `docs/devir/D2-ALTYAPI-TASARIM.md` §12.

## Olay (GitHub CI #1115, commit 1c903a36, iş 'Test (windows-latest, Node 24)'; ana oturum iş günlüğünün son satırlarından AYNEN okudu)
```
✖ kalıcı geçici hata (EBUSY hiç bitmez) → sınırlı deneme (12), 503 devir-backup-move + Türkçe neden; yazılmış klasör silinmez, listede Yarım [test/devir-d4on-yedek-tasima-251.test.mjs:90:3] — AssertionError [ERR_ASSERTION]: undefined unable to open database file · undefined !== 503
✖ yeniden denenmeyen hata (EXDEV) → hemen 503 (tek deneme, bekleme yok); klasör listede Yarım [test/devir-d4on-yedek-tasima-251.test.mjs:121:3] — AssertionError [ERR_ASSERTION]: undefined unable to open database file · undefined !== 503
npm-test-windows-latest-node24: 6159/6161 geçti, 2 başarısız
```
Linux'ta ve Windows Node 22'de (o koşuda sürüyordu) aynı testler yeşil / bilinmiyor. Bağımsız dar kontrol (tur 1'in farkı) Linux'ta YÜKSEK / ORTA bulmadı; DOĞRULANMADI başlığında şunu yazdı: "Windows'ta klasörün içindeki dosya açıkken taşıma gerçekten EPERM veriyor mu?"; "yedek içindeki düz dosya taşıması (`.sqlite.yaziliyor` → ad) düz `renameSync` — Windows'ta antivirüs orada da tutarsa devir yedeği düşer"; "son dosyanın özeti `end` olayında bitince akışın tutamağı biraz sonra kapanıyor".

## İş
0. NASIL BOZULUR + KÖK NEDEN HİPOTEZLERİ (koddan ÖNCE, commit): 'unable to open database file' iletisini hangi çağrı üretebilir (ürün yolu mu, testin sahte rename'i mi — ör. sahte, iç dosya taşımasını da yakalıyor ve Windows yol ayırıcısıyla eşleşme farklı; ya da taşınamayan klasördeki veri tabanı Windows'ta açık tutamak yüzünden açılamıyor); her hipotez için Linux'ta zorla üretme yolu (ders 20: önce kırmızı üret — Windows yol biçimi `path.win32` ile, açık tutamak `openSync` ile, tutamak kapanış gecikmesi ile).
1. Kırmızıyı Linux'ta ZORLA üret (ders 20); üretemezsen hangi hipotezlerin Linux'ta üretilemeyeceğini kanıtla. Kök nedeni yaz (ders 6). Tahminle düzeltme yapma.
2. DÜZELT: ürün yolunda hata ise ürün kodunu (dosya sınırı aşağıda); testte ise testi (ders 34: test ürün davranışını gizlemez — taşıma hatasında kullanıcı 503 + Türkçe ileti almalı; 'unable to open database file' kullanıcıya gidiyorsa bu ÜRÜN hatasıdır). Taşıma hatası iletisinde iç kod / İngilizce metin GÖSTERİLMEZ (kullanıcı kararı 27.11 11:39 AYNEN: "devir yapılırken bir sebeple duruyorya, nedenini kullanıcıya açıkça türkçe yazsın program, önerilerine ek olarak bunuda uygula." — bu yolda iletinin ne oldu / neden / ne yapmalı / nereye düzeni; iç kod yalnız makine alanında); ilgili test beklentisi buna göre.
3. Yeni / değişen test: eski kodda (taban; AYRI kopya) BEKLENEN NEDENLE kırmızı (ders 7, 38, 51), yenide yeşil, iki TZ; tur 1'in mutasyon betiği AYNEN 11/11 + en az bir yeni mutant.
4. Windows: bu ortamda Windows YOK. Raporda ana oturuma 'CI'de Windows Node 22 ve 24, İKİ koşu (ders 18, 48)' yaz; testin Windows'ta neyi denetlediğini açıkça yaz.

## Dosya sınırı
`server/lib/devir/devir-backups.mjs`, `server/lib/backup.mjs` (YALNIZ devir yedeğinin iç dosya taşıması — başka yedek yolu DEĞİŞMEZ; değişirse komşuları: yedek / geri yükleme testlerinin hepsi, ders 10), `test/devir-d4on-*`, `test/fixtures/**`. YASAK: başka her şey; istemci, göçler, `.github/**`, `package.json`.

{kurallar('d4ont2', taban="t251-d4on-t2-taban")}

{rapor()}
"""

# ---------------------------------------------------------------- DAR KONTROLLER (27.11; prensip §9 iskeleti — düzeltmenin raporu / görev metni VERİLMEZ)
def dar(ad, n, aralik, isler, kararlar, yorumlar, ne_ara, yasak):
    return f"""Sen DestekOfis projesinde bağımsız DAR KONTROL {n} incelemecisisin (2.5.1; eforun high); yalnız HATA ararsın, düzeltme / commit / push YAPMAZSIN, çalışma ağacının izlenen dosyalarına dokunmazsın. Yanıtın Türkçe. Kendi arka plan işin sürerken rapor vermeden BİTİRME.

ÖNCE oku: `CLAUDE.md` (anayasa, test kuralı, dersler 1–55), `docs/BAGIMSIZ-DOGRULAMA-PRENSIBI.md` (TAMAMI — §3 senin kuralların). OKUMA (bağımsızlık — prensip §3): {yasak}; iş listesinin KAYIT dosyası.
KAPSAM (DURMA KURALI — yalnız bu fark): depo {ANA} (kendi ağacında `git log --oneline -1` ile `{aralik.split('..')[1]}` ucunun geçmişte olduğunu doğrula), `git diff {aralik} -- . ':!docs'`; bu farktaki işler: {isler}
KULLANICI KARARLARI (AYNEN):
{kararlar}
BAŞ MİMAR YORUMLARI (DEĞERLENDİR — karar metnine uyuyor mu; uymuyorsa ya da iki okuma çıkıyorsa raporda 'KULLANICIYA SORULMALI'):
{yorumlar}
{KURALLAR_KULLANICI}
NE ARA: {ne_ara} + prensip §3 genel listesi (kararın yanlış / eksik uygulanması; değişen yardımcıyı kullanan HER çağıran — `git grep` taramasıyla, ders 10; gün / ay / yıl dönümü ve saat dilimi TZ=UTC ve TZ=Europe/Istanbul — ders 13, 22; yarıda kesilme; eski veri ve göç; iki şirket / yedek geri yükleme — ders 17; yeni testin dişi: eski kodda BEKLENEN NEDENLE kırmızı mı — ders 7, 38, 51; mutasyonda rastlantıyla geçen test).
YÖNTEM: prensip §3 — her bulgu GERÇEK programda betikle zorla üretilir (`HUKUK_LICENSE_URL=http://127.0.0.1:9`; gerçek dış servis YOK), çıktıda sayı; eski kod AYRI kopyada (`git worktree add --detach /dev/shm/{ad}-eski {aralik.split('..')[0]}` — ders 23, 54; işin bitince `git worktree remove` zorlamasız); not defterin BENZERSİZ: `{SP}/{ad}/` (ders 25). Koşular `flock -s -w 3600 {SP}/olcum.lock timeout -k 5 <sn> <komut>`; önce `cat /proc/loadavg`, 4'ün üstündeyse tek seferlik bekle. `node_modules` için `ln -s {ANA}/node_modules node_modules` (`npm ci` YOK); tarayıcı `PLAYWRIGHT_BROWSERS_PATH={SP}/pw-1194`. Tam `npm test` YOK. `pkill` / `killall` / joker `rm` YOK; yalnız kendi tam yolun silinir (ders 36). GIT_DIR / GIT_WORK_TREE VERME (ders 54). Disk 5 GB'ın altına düşmez.
RAPOR (son iletin): her bulgu için sınıf (YÜKSEK / ORTA / DÜŞÜK), dosya:satır, betik yolu + çıktı (sayılarla), kök neden, eski kodda durum (gerileme mi, önceden var mı), en küçük düzeltme önerisi; para / kapama / 'kime kaç kez' kuralı gerekiyorsa 'KULLANICIYA SORULMALI' (iki seçenek + öneri + sayılar; uç durumsa 'Uç durum böyle kalsın (BİLİNEN SINIR)'); sonra DOĞRULANMADI ve DENENMEYEN; 'SONRAKİ SÜRÜME' (programı / kullanıcıyı etkilemeyenler — 20.11 kuralı). Bulgu yoksa açıkça 'YÜKSEK / ORTA YOK'. Okuduğun dosyaların listesi (bağımsızlık denetimi için).
"""

DK_D4ON = dar("dk-d4on", "D4-ÖN", "64396478..fce0e31f",
 "devir yedeğinin son adına taşınmasına Windows'ta yeniden deneme; belge temizliğinin devir arşivlerinin başvurularını görmesi; D2 tasarımındaki iki yorum tutarsızlığı; bunların testleri ve mutasyon betiği.",
 """- 2.5.1 plan taslağı (kullanıcı 27.11 AYNEN: "önerilerini uygula açık sorularında"; kapsam kararı "tüm işler bu sürümde yapılsın") §1 'D4 ön koşulları [H] (D4'ten ÖNCE, ayrı küçük paket)': "Windows'ta devir yedeğinin son adına taşınmasına yeniden deneme + Windows'ta zorla üretilen kırmızı (26.11 CI kırmızısı; ders 18, 48). Belge temizliğinin arşivin başvurularını görmesi (G8; yoksa yeni yılda silinen belge arşivden de gider). D2 tasarım §12'deki iki yorum tutarsızlığı."
- Devir planı `docs/devir/DEVIR-PLANI.md` G8 (oku: yalnız G8 ve §0 / §1).""",
 """- (1) Arşivin kendi silinmiş belge kaydında çalışma yılının kuralı: 30 günü geçmemiş silinmiş kayıt dosyayı tutar, geçmiş olan tutmaz.
- (2) Taşımada eşzamanlı yeniden deneme (en kötü ~3,3 sn olay döngüsü; yedek bakım kipinde alınır) — kabul edildi; D4b tasarımında yeniden bakılacak.
- (3) Windows'ta gerçek ön koşullu koşu CI'de okunacak (ders 18) — senin Linux koşun Windows'u kanıtlamaz; Windows'a özgü kuşkuyu DOĞRULANMADI başlığında yaz.""",
 "yeniden denemenin sınırı ve sonunda ne olduğu (son hata yutuluyor mu, yarım kopya kalıyor mu, kaynak / hedef ikisi birden kayboluyor mu); yeniden denemenin yanlış hata kodlarında da denemesi; taşıma sırasında açık tutamak (ders 48 — 'açmayı denedi → sonra dosya değişti' sırası); belge temizliğinin arşiv başvurusunu görmediği yollar (iki arşiv, arşivi silinmiş / bozuk / kilitli şirket, aynı belge iki yılda, 30 gün sınırı ±1 gün, saat dilimi); temizlik yanlışlıkla HİÇ silmiyor mu (yeni yılda gereksiz büyüme); şema kapısı testinin değişen beklentisi gerçekten haklı mı (ders 10: ortak katman); iki yorum değişikliğinin kodla uyumu.",
 "`docs/devir/2.5.1-DEVAM/d4on-*` (düzeltme ajanının görev metni ve raporu)")

DK_M1 = dar("dk-m1", "M1", "64396478..f2b3b668",
 "KDV Özeti (Beyanname Hazırlığı): 'Önceki Dönemden Devreden KDV' satırı, ödenecek / sonraki döneme devreden tutarın mahsup fişi formülüyle hesabı, mahsup fişi kesilmemiş aylarda ZİNCİRLİ devreden ve notlar ('Mahsup Edilmemiş Ay', 'Zincirle Uyuşmayan Mahsup Fişi'), adlar; beklentisi değişen testler / ekran senaryoları ve iki yeni ekran senaryosu.",
 """- S261 (2.5.0 mali müşavir ara kabulü ORTA-1; KULLANICI 22.11 19:47 UTC AYNEN: "orta bulguyu 2.5.1 de düzeltelim"): KDV Özeti (Beyanname Hazırlığı) özetinin ve tablo altının 'Ödenecek / Devreden KDV' satırı önceki aydan devreden KDV'yi görmüyor; 391 / 191 satırları iadeleri düşülmüş gösteriyor. Örnek: Ocak alış KDV 2.000 + Ocak mahsubu (sonraki aya devreden 2.000), Şubat satış KDV 1.200 → Şubat KDV Özeti 'Ödenecek KDV 1.200,00 TL' (yanlış), Şubat mahsup fişi ön izlemesi önceki aydan devreden 2.000 / sonraki aya devreden 800 / ödenecek 0 (doğru — defter ve mahsup fişi DOĞRU).
- 2.5.1 plan taslağı §2 'M1 [H]': "'Önceki Dönemden Devreden KDV' satırı, ödenecek / sonraki döneme devreden mahsup fişindeki formülle; adlar iadelerin düşüldüğünü söylesin; tablo altı 'Net KDV' aynı."
- S-M1-1 = B (KULLANICI 27.11 07:07 UTC AYNEN: "önerini uygula"). Soru: mahsup fişi kesilmemiş aylarda KDV Özeti'nin "Önceki Dönemden Devreden KDV"si nereden gelsin? A: defterdeki bakiyeden (mahsup ön izlemesiyle aynı; atlanan ayda zincir kopar). B (SEÇİLEN): zincirli — atlanan ay sırayla mahsup edilmiş gibi hesaplanır, özette "Mahsup Edilmemiş Ay" notu. Örnek: Eylül sonu devreden 1.960, Ekim satış KDV 400 mahsup edilmedi, Kasım satış KDV 1.000 → A: Kasım önceki 1.960 / sonraki 960; B: önceki 1.560 / sonraki 560.
- S-M1-3 = C (KULLANICI 27.11 09:29 UTC AYNEN: "önerilerini uygula, sıkıştırma hazırlığı yap"): mahsup fişi kesildikten SONRA o aya kayıt girilmiş / değişmiş ayda raporun o ay sonucu güncel kayıtlardan, sonraki ayın 'önceki dönemden devreden'i kesilmiş fişten gelir — BİLİNEN SINIR; o aya kısa not SONRAKİ KÜÇÜK TURDA eklenecek (bu farkta YOK — eksikliği bulgu sayma).""",
 """- (1) Zincirin tanımı: mahsup edilmiş aylarda zincir defterle (kesilmiş fişle) eşit; mahsup edilmemiş ay sırayla mahsup edilmiş gibi; kopuk zincirde not.
- (2) Mahsup ön izlemesi / fişi / defter DEĞİŞMEZ (yalnız rapor); ön izlemenin zincire uyması ayrı karar.
- (3) 'Önceki KDV'li ay mahsup edilmeden sonraki ay mahsup EDİLEMESİN' — şimdilik HAYIR (bugünkü uyarı kalır).
- (4) 'Mahsup Edilmemiş Ay' notu en çok 6 ay adı + 've N ay daha'.
- (5) S-M1-2 (kopuk zincirde fişin YÖNÜ zincirle ters): sayılar aynı; not metni yön farkını da yazacak — SONRAKİ KÜÇÜK TURDA (bu farkta YOK).
- (6) GÖRÜNÜM (ana oturumun ekran yürüyüşü; SONRAKİ KÜÇÜK TURDA düzelecek — bilinen, bulgu sayma): tablo penceresi dar gelince tablo altındaki çok satırlı toplam bölümünde satırlar üst üste biniyor; not kartında uzun cümle kalın.""",
 f"zincirin yıl başında / ilk kayıttan önce / dönem kilidi ve Devir Kapanışı yapılmış aylarda nereden başladığı; yıllık özet ↔ ayların toplamı ↔ ekran = PDF = Excel (alt TOPLAM satırı); iade faturalı aylar (391 / 191 adları ve tutarı); KDV'siz ay, yalnız alış ayı, ödenecek ve devreden yön değişimi; mahsup fişi geri alınmış ay; sonraki yıl Ocak'ında Aralık'tan gelen devreden (yıl dönümü, iki saat dilimi); iki şirket; Muhasebe rolüyle açılış (yetki); hız (100 bin satırda yıllık özet — değişiklikten önce de ~2,5 sn; kötüleşme var mı: aynı veri kopyasıyla önce / sonra, `flock -x -w 1800 {SP}/olcum.lock` özel kilit, alamazsan 'ÖLÇÜLEMEDİ'); mahsup ön izlemesinin GERÇEKTEN değişmediği; beklentisi değiştirilen eski testlerin her değişikliği karara dayanıyor mu (ders 28, 40).",
 "`docs/devir/2.5.1-DEVAM/m1-*`, `m1t2-*` (düzeltme ajanlarının görev metinleri ve raporları)")

# ---------------------------------------------------------------- DEVİR SÜRÜCÜSÜ (27.11; kâhin ↔ D3 planı karşılaştırması — sürücü bakımı)
SUR = f"""Sen DestekOfis projesinde 2.5.1'in DEVİR SÜRÜCÜSÜ ajanısın (muhasebe sürücüsü bakımı: kodu görmeyen muhasebe kâhininin DEVİR senaryolarını programın DEVİR PLANI ile karşılaştırmak; eforun high). Sen KÖPRÜSÜN: ne kâhini ne programı DEĞİŞTİRİRSİN — yalnız sürücüyü (`test/bagimsiz/muhasebe-surucu/**`) yazar, farkı SINIFLAR ve raporlarsın. Program hatası bulursan DÜZELTMEZSİN (ayrı kod ajanı düzeltir); kâhin şüphesi bulursan kâhini DÜZELTMEZSİN (ayrı kâhin bakımı).

{hazirlik(taban="t251-surucu-taban", taban_ne="çalışma dalı (muhasebe kâhini devir bakımı birleşmiş) + devir saf hesabı tur 2 — etiket t251-d3-tur2 (0ae33184); birleşim 2cc4023f, ana dala GİRMEZ")}
NOT: devir saf hesabının tur 2 raporu `docs/devir/2.5.1-DEVAM/d3t2-rapor.md` (tabanda var) programın ön izleme / plan biçimini anlatır — SENİN girdin: §1 plan biçimi değişen alanları ve BM-T2-1 … BM-T2-4; ajanın kanıt / test ayrıntısı karşılaştırmanın kuralı DEĞİLDİR (kural kâhinden).
3. Sonra oku: sürücünün kendisi (`test/bagimsiz/muhasebe-surucu/` — `kos.mjs` başındaki açıklama TAMAMI, `program.mjs`, `karsilastir.py`, `siniflama.json`, `gerileme.py`); kâhinin README'sinde YALNIZ 'güncel kurallar dizini', devir bakımının bölümü (KD1–KD26) ve 'sürücü için çıktı sözleşmesi' (red kodları, devir raporu alanları, susulan girişler); devir saf hesabının raporu `docs/devir/2.5.1-DEVAM/d3-rapor.md` (plan biçimi §12, D4a eşlemesi §13, ön izleme uçları, DOĞRULANMADI) ve tasarım `{ANA}/docs/devir/D3-D4-TASARIM.md` §3. Kâhinin MODEL kodunu satır satır incelemen gerekmez; çıktısını (senaryolar + beklenen + karşılaştırma aracının verdiği sonuç) kullanırsın. Kâhin klasörüne (`test/bagimsiz/muhasebe/**`) YAZMA.

## Durum (bilmen gereken)
- Programda devir HENÜZ UYGULANMIYOR: yalnız ALTYAPI ve ÖN İZLEME var (hiçbir şey yazmayan DEVİR PLANI nesnesi + ön denetim + Devir Raporu). Devri uygulayan, geri alan paketler SONRA gelecek.
- Bu yüzden kâhinin devir senaryolarında İKİ tür beklenen var: (A) DEVİR ANINDA hesaplananlar — arşiv kapanışı, yeni yıl açılışı, kapanış fişleri ve sırası (önceki yıl sonucunun aktarımı dahil), açık kalemler ve vadeleri, kartlar (kapalı / ödenmiş / faturası iptal edilmiş dahil), şüpheli payı, devri DURDURAN ön denetim maddeleri (onay bekleyen Açılış Olabilir; düzeltilmemiş Kural Değişikliği Farkı) → BUGÜN plan nesnesiyle KARŞILAŞTIRILABİLİR; (B) DEVİRDEN SONRA yaşananlar — yeni yıl dosyasında Bilanço satırları, arşive dokunma redleri, cari türü / Defter Türü, Devri Geri Al, ikinci yıl devri, yeni yılda Ödeme Sözü hatırlatması → program uygulamadığı için BUGÜN karşılaştırılamaz; her biri KURAL KİMLİĞİYLE 'bekleyen' (U) sınıfına, hangi pakete bağlı olduğuyla yazılır (sessiz geçilmez).
- KULLANICI 27.11 (AYNEN: "1 ajan sürekli devir zincirinin işini yapsın, maş mimar olarak senin içinde uygunsa") — devir zinciri ara vermeden sürüyor; senin çıktın devri uygulayan paketin girdisidir.

## Kararlar
KULLANICI KARARLARI (27.11; hepsi "önerilerini uygula" kuralıyla): S-1 = A (önceki yıl kârı / zararı yeni yıla AYNEN açılır; sonraki devirde geçmiş yıl hesaplarına aktarılır), S-2 = A (onay bekleyen "Açılış Olabilir" kaydı varken devir DURUR), S-3 = A (düzeltilmemiş "Kural Değişikliği Farkı" varken devir DURUR).
ÜÇ UÇ DURUM (kullanıcı 27.11 yanıtladı: S-KD-1 = A yalnız alt defter farkı kalmışken de devir DURUR; S-KD-2 = A kilit kesim gününe dayanmış ve düzeltme fişi yeni yıla düşecekse devir DURUR; S-KD-3 = B Excel kartı Kayıt Tarihi'ne göre eski yıla sayılır) — AMA kâhin bu üç durumu HENÜZ işlemedi (SUSUYOR; ayrı kâhin bakımı gelecek) ve program da henüz kodlamadı → sen bu üç durumu 'susma' sınıfında bırakırsın, karşılaştırmazsın.
KULLANICI 27.11 (AYNEN: "devir yapılırken bir sebeple duruyorya, nedenini kullanıcıya açıkça türkçe yazsın program, önerilerine ek olarak bunuda uygula.") — DEVİR NEDEN DURDU: devri durduran her neden kullanıcıya açık Türkçe cümleyle yazılacak (ne oldu, neden duruyor, ne yapmalı, nereye gidilecek). SENİN PAYIN: ön denetimin DURDURAN her maddesi için programın bugün ürettiği cümleyi raporda AYNEN listele (madde → cümle → gidilecek yer); cümlesi olmayan, iç kod / İngilizce gösteren ya da ne yapılacağını söylemeyen maddeyi 'EKSİK İLETİ' diye işaretle (düzeltmezsin — sıradaki kod turunun girdisi).
BAŞ MİMAR KARARLARI 27.11 (kullanıcıya gösterildi; değiştirebilir): (1) Kâhinin kendi modelinde bulup kapattığı ÜÇ BOŞLUK programda AYRI SINIF olarak aranır ve raporda ayrı başlıkta yazılır: Ödeme Sözü'nün yeni yıla taşınması; bakiyesi sıfır carinin ödenmiş kartının ve faturası iptal edilip kapanmış kartın taşınması; arşivde hareketi olan carinin türü. (2) Devir saf hesabı raporunun BM-1 maddesi (şüpheli carinin devir "Alacak Toplamı" satırına şüpheliye aktarmanın girmesi) kâhinin sonucuyla karşılaştırılır — AYRI başlıkta: kâhin ne diyor (sayıyla), program ne diyor; fark varsa 'KULLANICIYA SORULMALI' (iki seçenek + öneri + uç durumsa üçüncü seçenek). (3) BM-5 (kesimden SONRA "Borçta Kalsın" ile kapanan kartın vadeleri) ve BM-6 (ödeme rolündeki açık kalem — tedarikçiye avans gibi — yeni yılda ödeme satırı ve asıl tarihli vade) kâhin senaryolarında varsa karşılaştırılır, yoksa 'kâhinde senaryosu yok' diye yazılır (kâhin bakımına girdi). (4) Fark sınıfları sürücünün var olan düzeniyle: AYNI · U (bekleyen; kural kimliği + paket) · P (program hatası — yeniden üretim betiğiyle) · K (kâhin şüphesi — gerekçesiyle) · R (kural belirsiz — kullanıcıya) · SUSMA · ÖLÇÜLEMEDİ; SINIFLANMADI kalmaz. P / K / R kararını SEN VERMEZSİN — önerirsin; `siniflama.json`'a elle kayıt ancak kanıtıyla ve raporda tek tek listelenerek.
{KURALLAR_KULLANICI}

## İş (her adım bitince commit)
0. EŞLEME TABLOSU (rapor taslağının başına, koddan ÖNCE, commit): kâhinin devir çıktısının her alanı ↔ plan nesnesinin alanı (ad ad; birim, işaret, tarih biçimi, hesap kodu / alt hesap gösterimi) ve kâhinin red kodları ↔ ön denetimin DURDURUR maddeleri. Eşlenemeyen alan 'ÖLÇÜLEMEDİ' + neden.
1. SÜRÜCÜ: kâhin senaryosunda devir olayına gelindiğinde programın o andaki verisinde ÖN İZLEMEYİ çalıştır (sürücünün var olan süreç / geçici veri / saat dilimi düzeniyle; lisans servisi yerel ölü adres — ders 30) ve planı (A) türü beklenenlerle karşılaştır. Devirden sonraki olaylar (B) uygulanmaz: senaryo o noktada 'bekleyen' diye kapanır, kalan adımların SAYISI raporda. Devir olayı içeren ESKİ senaryolar da (bakımdan önce yazılmış) aynı yoldan geçer.
2. İKİ SEÇENEK × İKİ SAAT DİLİMİ: devrin iki cari seçeneği ve UTC / Europe/Istanbul; her senaryo ayrı süreç.
3. ÖZ DENETİM (sürücünün dişi — ders 7): sürücünün karşılaştırması gerçekten yakalıyor mu — en az şu bozmalarda KIRMIZI ver: bir açık kalemin vadesi bir gün kaydırılır; bir carinin net satırı işaret değiştirir; kapanış fişlerinin sırası değişir; önceki yıl sonucunun aktarım fişi çıkarılır; kapalı kart listeden düşer; durdurması gereken ön denetim maddesi geçer. (Bozmalar sürücünün karşılaştırma girdisinde yapılır; programın kodu DEĞİŞTİRİLMEZ.)
4. GERİLEME: sürücünün devir DIŞI senaryolardaki sonucu tabanla AYNI (var olan gerileme aracıyla; sayılarıyla).
5. SONUÇ TABLOSU: senaryo × sınıf (AYNI / U / P / K / R / SUSMA / ÖLÇÜLEMEDİ), bekleyen kurallar kimlik → senaryo / denetim sayısı; P önerilerinin her biri için EN KÜÇÜK yeniden üretim (hangi senaryo, hangi adım, kâhin sayısı ↔ program sayısı, planın hangi alanı).

## Kabul koşulları
A. Kâhinin öz testi DOKUNULMADAN yeşil (kâhin klasörü değişmedi: `git diff --stat t251-surucu-taban -- test/bagimsiz/muhasebe` BOŞ). B. Programın kodu değişmedi (`git diff --stat t251-surucu-taban -- server client` BOŞ). C. Öz denetim bozmalarının HEPSİ kırmızı. D. Devir dışı senaryolarda gerileme yok. E. SINIFLANMADI = 0 (her fark bir sınıfta, gerekçesiyle).

## Dosya sınırı
YALNIZ `test/bagimsiz/muhasebe-surucu/**` + rapor + kanıt. `server/**`, `client/**`, `test/bagimsiz/muhasebe/**` (kâhin), öbür kâhinler, `package.json`, `.github/**`, `tools/**` YASAK. Sürücü programın yalnız DIŞA AÇIK uçlarını / işlevlerini kullanır; gereken bir uç yoksa DUR — 'BAŞ MİMAR KARARI GEREKİYOR'.

{kurallar('sur', kod=False, taban="t251-surucu-taban")}
- Koşular `HUKUK_LICENSE_URL=http://127.0.0.1:9 KANIT_DIR=<kendi not defteri klasörün> node tools/kanit.mjs kos sur-<ad> -- <komut>`; BÜTÜN koşuların `flock -s -w 3600 {SP}/olcum.lock` altında; her arka plan koşusu `timeout -k 5 <sn>` (en çok 2 saat; toplam sürenin 1,5 katından kısa olmasın — ders 55); önce `cat /proc/loadavg`, 4'ün üstündeyse tek seferlik bekle; sürücüyü en çok 2 paralel süreçle koş. Tam `npm test` YOK. Kanıt `docs/kanit/<bugünün tarihi>/sur-*` altında ayrı 'Kanıt:' commit'iyle; dosya adında Windows'ta açılmayan karakter olmaz (ders 33).

## Rapor (son iletin; Türkçe)
EN BAŞTA beş-altı cümlelik sonuç (kaç senaryo, kaç denetim, sınıf sayıları, program hatası önerisi var mı); eşleme tablosu; sonuç tablosu; P önerileri (yeniden üretimleriyle); K önerileri; R / KULLANICIYA SORULMALI (numaralı; iki seçenek + öneri + sayılar); kâhinin üç boşluğunun programdaki durumu; BM-1 / BM-5 / BM-6 sonucu; bekleyen kurallar (kimlik → paket); öz denetim tablosu; gerileme; ÖLÇÜLEMEDİ; DOĞRULANMADI; DENENMEYEN; kâhin bakımına girdi listesi; commit listesi; dal ucu; ana oturumun yeniden koşacağı komutlar.
"""

# ---------------------------------------------------------------- Mİ TUR 2 (27.11; tam testte düşen hakem testi + her yerde tek taksit numarası + dönem etiketi)
MI2 = f"""Sen DestekOfis projesinde 2.5.1'in MÜŞTERİ İSTEKLERİ TUR 2 KOD ajanısın (Mİ tur 2; eforun high). Tur 1 başka bir ajanla bitti (dal ucu etiketi t251-mi-tur1); sen temiz bağlamla YALNIZ aşağıdaki üç işi yaparsın (ders 46).

{hazirlik(taban="t251-mi-tur1", taban_ne="Mİ tur 1'in dal ucu (c674b41b)")}
3. Sonra oku: `docs/devir/2.5.1-DEVAM/mi-rapor.md` ve `mi2-tasarim.md` (tur 1'in raporu ve tasarımı — özellikle taksit numarasının TEK kaynağı, tarama tablosu, DENENMEYEN), tur 1'in görev metni `{ANA}/docs/devir/2.5.1-DEVAM/mi-istem.txt` (kararlar AYNEN geçerli), tur 1'in kodu (`git diff t251-taban..t251-mi-tur1 -- server client test`).

## Kararlar
KULLANICI 27.11 (müşteri istekleri — tur 1 görev metninde AYNEN).
S-Mİ1-1 = A (KULLANICI KARARI 27.11 08:06 UTC, AYNEN: "önerini uygula"): ekranda taksit numarası boşluksuz 1, 2, 3 (vade sırası) olmuştu; müşteriye giden çıktılar eski saklanan numarayı yazıyordu. KARAR: **müşteriye gidenler de aynı numaraya geçer — tek numara HER YERDE** (önceden verilmiş kâğıtla fark olabilir; teslim notuna yazılır). Reddedilen B: müşteriye gidenler eski numarada kalır.
BAŞ MİMAR KARARLARI 27.11 (kullanıcıya gösterildi; değiştirebilir):
 (1) TAM TESTTE DÜŞEN TEST (ana oturum buldu; tur 1 dalında tek başına da düşüyor, ana dalda geçiyor): `test/obligation-input-250.test.mjs` — "hakemden farklı çıktı (taşıma davranışı değiştirdi)" (taksit kartı olan beş cari sınıfı). NEDEN: tur 1'in taksit satırına eklediği görünen sıra numarası alanı TEK BORÇ SIRASININ GİRDİSİNE de sızıyor; hakem dosyası (`test/fixtures/obligation-input-250-hakem.json`) o girdinin değişmediğini denetler. KARAR: **hakem dosyası DEĞİŞMEZ** (hakem davranışın kâhinidir — ders 40; yeniden üretmek yasak). Görünen numara tek borç sırasının girdisine GİRMEZ: girdi baytı baytına eskisiyle aynı kalır; numara yalnız gösterim / çıktı yollarının okuduğu yerde bulunur (tek kaynak kuralı korunur — numarayı iki yerde hesaplama). Çözümü sen seç, raporda gerekçesiyle yaz; tek borç sırası modülünün kendisi (`server/lib/obligation-queue.mjs`) DEĞİŞTİRİLMEZ.
 (2) TARAMA DERSİ: tur 1'in komşu listesi bu testi seçmemişti (ders 10). Bu turda komşu listesi `git grep` ile, değişen HER işlevin adı ve onu çağıranların adlarıyla çıkarılır (taksit dağıtımı, kart özeti, cari satırları, tek borç sırası girdisi, makbuz, PDF'ler, ekstre, WhatsApp metni, Tablo, zil / takvim); raporda komşu listesinin NASIL çıkarıldığı (komutlar) ve dosya sayısı yazılır.
 (3) TEK NUMARA HER YERDE'nin kapsamı (hepsi; koddan TARA, burada sayılmayan bir yer bulursan EKLE ve raporda yaz): tahsilat makbuzu (ekran + PDF), taksit kartı PDF'i, Taksitler listesi (ekran + PDF + Excel), cari ekstresi (ekran + PDF + Excel), WhatsApp ekstresi ve elle (wa.me) metinleri, Tablo, zil / takvim / Vade Takip, Ödeme Hatırlatma iletisindeki taksit anlatımı (varsa), Rapor Merkezi'nde taksit numarası yazan raporlar, mobil özet. SAKLANAN sıra alanı VERİDE DEĞİŞMEZ (göç YOK); yalnız GÖSTERİLEN numara değişir. Geçmişte yazılmış ve SAKLANMIŞ metinler (ör. gönderilmiş WhatsApp iletisinin donmuş içeriği, kayıtlı makbuz metni varsa) YENİDEN YAZILMAZ — hangi çıktı anlık üretiliyor, hangisi saklı: tabloyla raporla.
 (4) Cari Listesi'nde dönem seçildiğinde dönem seçicinin "Tahsilat Dönemi:" etiketi kayboluyor (ana oturumun ekran yürüyüşünde görüldü) — etiket her durumda görünür kalır.
 (5) Para / bakiye / gecikmiş / tahsilat SAYILARI bu turda DEĞİŞMEZ (yalnız numara gösterimi ve etiket). Değişen bir sayı görürsen DUR — hata.
{KURALLAR_KULLANICI}

## İş (her adım bitince commit)
0. NASIL BOZULUR (rapor taslağının başına, koddan ÖNCE, commit): taksiti silinmiş kart ('1., 3.' → '1., 2.'); vadesi öne alınmış taksit; araya eklenen taksit; aynı vadeli iki taksit; kapatılmış / yeniden açılmış kart; "Borçta Kalsın" ile kapanan kart; Excel'den yüklenen kart; kısmen ödenmiş taksit; iade ile küçülen kart; silinip geri yüklenen kart; iki kartlı cari; makbuz tahsilattan SONRA taksit silinirse (makbuz yeniden açılınca numara ne yazar); iki şirket; dönem kilidi; eski sürümden gelen veri.
1. DÜZELTME (karar 1): hakem testi YEŞİL, hakem dosyası `git diff` ile DEĞİŞMEMİŞ; tek borç sırasının girdisinin değişmediğini gösteren ek sınama (taksitli cari sınıflarında girdide numara alanı YOK).
2. TEK NUMARA (karar 3): her çıktı yolu için sınama — taksiti silinmiş kartta ekran, makbuz, PDF, Excel, ekstre, WhatsApp metni AYNI numarayı yazar (elle beklenen: '2. taksit'); PDF / Excel içeriği dosyadan OKUNARAK (ders 3).
3. ETİKET (karar 4): ekran senaryosuna denetim.
4. EKRAN SENARYOLARI: tur 1'in iki senaryosu (`senaryo-mi1-251`, `senaryo-mi2-251`) güncellenir ve KOŞULUR (ders 28); beklentisi değişen her var olan ekran senaryosu KOŞULUR.

## Kabul koşulları
A. `npm run test:kahin-cari` ve `npm run test:kahin-defter` iki TZ — tur 1 ile AYNI. B. `test/obligation-input-250.test.mjs` iki TZ yeşil + hakem dosyası değişmedi. C. Tur 1'in BÜTÜN testleri + karar (2)'ye göre çıkarılmış komşu listesi iki TZ yeşil. D. MUTANTLAR: tur 1'in mutantları + en az: numarayı saklanan sıradan oku (bir çıktı yolunda); numarayı tek borç sırası girdisine geri sızdır; aynı vadeli iki taksitte sırayı ters çevir; etiketi dönem seçilince gizle — her biri en az bir testte kırmızı. E. Yeni sınamalar tur 1 kodunda (taban t251-mi-tur1; AYRI kopya) BEKLENEN NEDENLE kırmızı (makbuz '3. taksit' yazıyor; hakem testi kırmızı).

## Dosya sınırı
Tur 1'in dosyaları + taksit numarasını GÖSTEREN / YAZAN çıktı yolları (makbuz, PDF / Excel üreticileri, ekstre, WhatsApp metin kurucusu, Tablo, zil / takvim, mobil özet, Rapor Merkezi'nin taksit numarası yazan raporları — YALNIZ numara gösterimi). YASAK: tek borç sırası modülü, Değersiz Alacak / şüpheli dosyaları ve Cari ekranındaki Değersiz formu (başka ajanda), KDV Özeti ve KDV mahsup hesabı (başka ajanda), devir modülleri (başka ajanda), `test/bagimsiz/**`, göçler, hakem dosyası.

{kurallar('mi2', taban="t251-mi-tur1")}

{rapor()}
Ek olarak raporda: 'anlık üretilen ↔ saklı metin' tablosu (karar 3); teslim notu için tek cümle (kullanıcı dilinde: numara değişikliği ve eski kâğıtlarla fark); komşu listesinin çıkarılış komutları.
"""

for ad, metin in (("pd", PD), ("d4on", D4ON), ("mi", MI), ("m1", M1), ("d3", D3), ("m1t2", M1T2), ("pc5c", PC5C), ("m2", M2), ("d3t2", D3T2), ("d3t3", D3T3), ("sur", SUR), ("mi2", MI2), ("dk-d4on", DK_D4ON), ("dk-m1", DK_M1), ("d4ont2", D4ONT2)):
    yol = os.path.join(out, f"{ad}-istem.txt")
    open(yol, "w", encoding="utf-8").write(metin)
    print(ad, len(metin.encode()), yol)
