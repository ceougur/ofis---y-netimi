#!/usr/bin/env python3
# Ç5-C kâhin bakımları 2. tur: WhatsApp kâhini güncellemesi 22 + cari kâhini bakımı 32 — karar girdisi (c5c2-kararlar.md) ve iki görev metni.
# Kullanıcı kararlarının metni iş listesinin C / D bölümünden AYNEN çekilir (elle yeniden yazılmaz). Ana oturum yazdı, 27.11.2026.
import re
D = '/home/user/ofis---y-netimi/docs/devir/2.5.1-DEVAM/'
IS = open('/home/user/ofis---y-netimi/docs/2.5.1-IS-LISTESI.md', encoding='utf-8').read()
IS250 = open('/home/user/ofis---y-netimi/docs/2.5.0-IS-LISTESI.md', encoding='utf-8').read()
SP = '/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad'

def satir(anahtar, metin=IS):
    i = metin.find(anahtar)
    assert i >= 0, anahtar
    b = metin.rfind('\n', 0, i) + 1
    e = metin.find('\n', i)
    s = metin[b:e]
    assert metin.count(anahtar) == 1, anahtar
    return s.strip()

def soru(kod_basi):
    # C'deki soru satırı: "- YANITLANDI (...) ~~SORULDU~~ (...) <KOD> (...): metin" → yanıt + soru metni AYNEN
    return satir(kod_basi)

K_1701 = satir('KULLANICI KARARI 27.11 17:01 UTC')
K_1816 = satir('KULLANICI KARARI 27.11 18:16 UTC').split(' UYGULAMA (baş mimar')[0] + ' [satırın UYGULAMA kısmı programın iş planıdır — kâhin girdisine alınmadı]'
S_W1 = soru('S-W21-1 (WK 21')
S_W2 = soru('S-W21-2 (WK 21')
S_W3 = soru('S-W21-3 (WK 21')
SK56 = soru('SK-56 (cari kâhini bakımı 31')
SK57 = soru('SK-57 (aynı kaynak; PARA')
SK58 = soru('SK-58 (aynı kaynak; PARA / GÖRÜNÜM')
ST41 = soru('S-T4-1 (D3 tur 4 raporu')
K28 = satir('(3) 2B-S2 / 28 = A:', IS250)

KARARLAR = f"""# Ç5-C — Ödeme Hatırlatma: WHATSAPP KÂHİNİ GÜNCELLEMESİ 22 + CARİ KÂHİNİ BAKIMI 32 — KARAR GİRDİSİ (2.5.1; ana oturum yazdı, 27.11.2026)

Bu dosya iki kâhin bakımının TEK yeni karar kaynağıdır (CLAUDE.md ders 5, 40, 43, 45). Bir önceki bakımların girdisi `c5c-kararlar.md` ve onun gösterdiği onaylı ilke
taslağı `docs/devir/C5C-ILKE-TASLAK.md` AYNEN geçerlidir (ikisi de izinli). Önceki kararlar kâhinin kendi README / KARARLAR.md'sindedir. Burada programın kodu, dosya adı,
alan adı YOKTUR. Aşağıdaki soru metinleri iş listesinin soru bölümünden AYNEN alınmıştır (ana oturum yeniden yazmadı); içlerindeki "program bugün … veriyor", "v2.5.0'ın
gerçek kodu", "gerçek veri (tohum 11)" gibi cümleler programın DAVRANIŞININ ÖLÇÜMÜDÜR — kural kaynağı DEĞİLDİR; kural, satırın başındaki "YANITLANDI … = A" ile seçilen
şıktır. Bir kuralın iki okuması çıkarsa KODLAMA — raporda "KULLANICIYA SORULMALI" (TOPLU KÂHİN BAKIMI: bulduğun bütün alt durumları BİRLİKTE çıkar; para / kapama /
"kime kaç kez" soruları beklenir — ders 43, 45).

OKUNMAZ (bağımsızlık): `docs/devir/2.5.1-DEVAM/pc5c-*`, devir saf hesabının raporları ve ileti katalogları (`d3*-rapor.md`, `d3*-iletiler.md`), iş listesinin kendisi
(metinler burada AYNEN), programın kodu ve testleri.

## 1. KULLANICI KARARLARI (AYNEN)

### 1.1 WhatsApp kâhini güncellemesi 21'in üç sorusu (yanıt: hepsi A)
{K_1701}

Soruların metni (AYNEN; seçenekler ve sayılar):
{S_W1}
{S_W2}
{S_W3}

### 1.2 Cari kâhini bakımı 31'in üç sorusu (yanıt: hepsi A — aynı ileti, yukarıda)
{SK56}
{SK57}
{SK58}

### 1.3 Kilit sınırında bağ — 2.5.0 kararı (madde 28 / 2B-S2 = A) ve 2.5.1 netleştirmesi (S-T4-1 = A)
2.5.0 KARARI (2.5.0 iş listesi D, AYNEN): {K28}
2.5.1 KULLANICI KARARI (AYNEN): {K_1816}
Sorunun metni (AYNEN; içindeki program sayıları ÖLÇÜMDÜR):
{ST41}

BAŞ MİMAR OKUMASI (kullanıcıya gösterildi; DEĞERLENDİR, karar metnine uyuyor mu): S-T4-1 = A yeni bir kural değil, madde 28 = A'nın ÖLÇÜM ANINI netleştirir — "kilitli
dönemde bağsız kapanmış kısım", kilitli dönemin GERÇEK durumunda (kilit tarihine kadarki kayıtlar, bağsız ödemeler kendi tarihlerindeki S2 sırasıyla; kilitten sonraki
bağ HENÜZ YOKKEN) ölçülür; sonradan kurulan bağ yalnız o anda AÇIK kalan kısmı kapatabilir, fazlası bağsız ödeme gibi vadesi en önce gelen açık borca gider. Sorunun
örneğinde: fatura 350,40, kilitli dönemde 175,20 iade + 175,20 bağsız havale ile kapanmış → kilit anında açık kısım 0 → 06.01.2027'deki 128,00 bağlı tahsilat bağsız gibi
dağılır → açık kalemler 280,00 (vade 22.12.2026) + 1.245,40 (vade 19.01.2027), 19.01'e kadar gecikmiş 280,00; bakiye 1.525,40. Kilit kaldırılınca kural o dönem için kalkar
(açık dönemde bağ önceliği — madde 24; kaynak: kural kitabı EK-2B madde 28'in 'KURAL (öneri A, kâhin biçimi)' metni).

## 2. İŞ BÖLÜMÜ (B-1 AYNEN — iki kâhin AYRI ajanlardır, birbirinin klasörünü okumaz, yazmaz)
- **WHATSAPP KÂHİNİ (güncelleme 22):** §1.1'in üç kararı — güncelleme 21'de iki okumayla (`secenek`) ya da "KULLANICIYA SORULMALI" diye bırakılan yerler TEK davranışa iner.
  Kime / tutar yine GİRDİ (elle). Devri Geri Al'dan sonra devirle durmuş işin dönen dosyadaki ADI (güncelleme 21'in iki okuma kabul ettiği bilgi) bu bakımda TEKLEŞMEZ —
  devri uygulayan paket tek davranışı seçince sonraki bakımda (BAŞ MİMAR KARARI 27.11 16:22 (2)); iki okuma yaprağı aynen kalır.
- **CARİ KÂHİNİ (bakım 32):** §1.2'nin üç kararı (bakım 31'de susan / iki okumalı yerler tek davranışa) + §1.3 (madde 28 = A + S-T4-1 = A — kâhinin dilinde bugün
  "kilitli bağ" YOK; kilit yalnız vade alanlarını kilitliyor) + bakım 31'in yarım kalan işleri (§3).

## 3. BAKIM 31'İN YARIM KALANLARI (BAŞ MİMAR KARARI 27.11 16:47 — kullanıcıya gösterildi)
Bakım 31'in son düzeltmesinden sonra öz test, G3, tam mutasyon ve yapım aşaması listesi KOŞULMADI; kâhinin kendi karar belgesine kanıt sayıları yazılmadı. Bakım 32 bunları
kendi kodunun üzerinde (bakım 31 + 32 birlikte) bir kez yapar; G3 tabanı bakım 31'in tabanıdır (bakım 30'un ana daldaki birleşimi) — iki bakımın bütün değişen beklentileri
birlikte, nedenleriyle. Ana oturumun yeniden koşusu bakım 31 + 32'yi birlikte görür (ayrı bakım 31 koşusu açılmaz — token tasarrufu; kalite kapıları aynen).

## 4. Senaryo sınıfları (her satır EN AZ bir elle senaryo; beklenenler ELLE, kâhin koşulmadan)
- WhatsApp kâhini: S-W21-1 (Sonucu Belirsiz + söz → Yine de Gönder gider, onayda "Ödeme Sözü Var"; içerik gönderim anındaki tutar); bekleyen belirsizlik onaylı işte söz
  verilip asıl işte yeniden basılınca (S23'ün söz karşılığı); S-W21-2 (söz için eklenen kişiye kuyruktayken şüpheli → "Atlandı — Şüpheli Alacağı Var"; şüpheli için eklenene
  sonra söz → "Atlandı — Ödeme Sözü Var"; başlatmada iki etiket birlikte → ikisi birlikte aşılır, gider); S-W21-3 (2. denemeden önce elle sayılan iş → 2. deneme gönderim
  anındaki şüphesiz tutarla; elle iz değişmediyse 5.2 aynen); her sınıfta "aynı gün en çok bir" ve "çıkmaz yok" değişmezleri; iki saat dilimi; gün dönümü.
- Cari kâhini: SK-56 (sözlü kalem ödenince söz biter — başka gecikmiş kalem için hatırlatma gider; sözlü kalem kısmen ödenince? → iki okuma çıkarsa SOR); SK-57 (yeni kart
  sınırı 600 — 600,01 ve 900 reddedilir; öbür kartın açık taksitleri ikinci kez taksitlendirilmez); SK-58 (yeni kart karta girmemiş açık borcu taşır; sonraki göstergeler,
  gecikmiş ve hatırlatma tutarı buna göre); madde 28 / S-T4-1 (sorunun örneği AYNEN + 2B-S2'nin F1 / F2 / F3 örneği + kilit kaldırılınca bağ önceliği geri gelir + kilit
  sınırında aynı gün + kısmi bağsız kapanış: kilit anında açık kısım > 0 iken bağ yalnız o kadarını kapatır, fazlası bağsız + Mahsup Et / iade / kart tahsilatıyla gelen
  bağ); kilitli = kilitsiz karşılaştırması YAPILMAZ (madde 28 kilidin kendisinin sonucudur).
"""

ORTAK_YASAK = ("Programın KODUNU GÖRMEZSİN: `server/`, `client/`, `tools/` (yalnız `tools/kanit.mjs` ÇALIŞTIRILIR), `bulut/`, programın `test/*.test.mjs` dosyaları, "
               "`test/e2e/`, `test/mutabakat/`, öbür kâhinler ve sürücüleri, `docs/kanit/` (kendi kanıtların dışında), `docs/2.5.0-IS-LISTESI*`, `docs/2.5.1-IS-LISTESI*`, "
               "`docs/devir/2.5.0-DEVAM/` ve `docs/devir/2.5.1-DEVAM/` (bu görevin KARAR GİRDİSİ `c5c2-kararlar.md` ve bir önceki girdi `c5c-kararlar.md` hariç; `pc5c-*`, "
               "`d3*` dosyaları KESİNLİKLE okunmaz), `docs/erp/*-TASARIM.md`, yapım aşaması listesinin içeriği (yalnız üretici komutu çalıştırılır) ve git geçmişi "
               "(kendi bakımının commit'leri ve `git diff <taban>..HEAD -- <kendi klasörün>` dışında) OKUNMAZ.")

def kurallar(kisa, yollar):
    return f"""## Kurallar
- YAZABİLECEĞİN: yalnız {yollar} ve `docs/kanit/<bugünün tarihi>/{kisa}-*`. Başka her şey YASAK.
- Koşular `KANIT_DIR=<not defterin> node tools/kanit.mjs kos {kisa}-<ad> -- <komut>` (iki saat dilimi: TZ=UTC ve TZ=Europe/Istanbul); ölçüm DIŞI HER koşu `flock -s -w 3600 {SP}/olcum.lock timeout -k 5 <sn> <komut>` altında (süre sınırı flock'un İÇİNDE; kilitsiz koşma). Not defterin BENZERSİZ: `{SP}/{kisa}-<kısa>/`. Arka plan koşusu en çok 2 saat; sınır, adımların ölçülmüş süresinin toplamı × 1,5'ten küçük olmasın; ağır parçalar ayrı ve paralel, her biri kendi sınırıyla; sınıra takılan parça BELİRSİZ, yalnız o parça yeniden koşulur (ders 55). Önce `cat /proc/loadavg`, 4'ün üstündeyse tek seferlik bekle. GIT_DIR / GIT_WORK_TREE VERME. `pkill` / joker `rm` YOK. Tam `npm test` YOK. Disk 5 GB'ın altına düşmez. Commit'e yalnız kendi yolların (`git add <yol>`; `-A` / `-u` / `commit -a` YOK).
- Kâhin programa UYDURULMAZ (ders 40): kural yalnız karar girdisinden ve kâhinin kendi belgesinden. Kural başına yorum KODDAN ÖNCE commit'lenir.
- 20.11 KURALI (kullanıcı AYNEN: "yapılan işlerde döngüye girmeyelim detaylara boğulup, programı yada kullanıcıyı etkileyemem hususları 2.5.1 sürümüne bırakalım"): programın davranışını / sayılarını / kullanıcının gördüğünü DEĞİŞTİRMEYEN iç hususlar (kâhin iç düzeni, belge, sayaç) kovalanmaz — raporda 'SONRAKİ SÜRÜME' başlığına.
- Commit iletisi sonunda TAM olarak (model adı HİÇBİR yerde yazılmaz):
  Co-Authored-By: Claude <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01EhegDvmPQ9hx2ibfitm6og"""

RAPOR = """## Rapor (son iletin; Türkçe; kısa cümle, madde, tablo)
Özet; kural başına yorum (ne değişti, girdinin hangi satırından); her sınıf için elle beklenen sonuçlar (tablo) ve önceki bakımdaki iki okumadan hangisinin kaldığı; öz test + mutasyon sayıları (iki TZ); G3 (değişen her beklenti nedeniyle; beklenmeyen 0); KULLANICIYA SORULMALI (iki seçenek + öneri, sayılarla; uç durumsa 'Uç durum böyle kalsın (BİLİNEN SINIR)'; 'yaygın programlarda' — kaynak okunmadıysa 'okunmadı'); SONRAKİ SÜRÜME; DENENMEYEN; okunan dosyaların listesi (bağımsızlık denetimi için); değişen yollar; commit listesi; dal ucu; ana oturumun yeniden koşacağı komutlar (her biri tek satır, süresiyle)."""

WK22 = f"""Sen DestekOfis projesinde WHATSAPP KÂHİNİ GÜNCELLEMESİ 22 ajanısın (2.5.1 Ç5-C — Ödeme Hatırlatma: KAÇ KEZ / NE ZAMAN / HANGİ İÇERİK; dış servise bağlı, durum tutan özellik — ders 45; kodu görmeyen temiz oda modeli; eforun high). Güncelleme 21 başka ajanla bitti (dal ucu etiketi t251-wk21); sen temiz bağlamla YALNIZ onun üç sorusunun kullanıcı yanıtlarını işlersin. {ORTAK_YASAK} Bu kâhinin klasöründeki `surucu.mjs` ve `sahte-meta/` da OKUNMAZ. Programla karşılaştırma koşusu SENİN işin DEĞİL (ana oturum yapar). Yanıtın Türkçe. KENDİ dalında commit edersin; PUSH YOK. Her bitmiş adımı HEMEN commit et; koşuları ≤ 40 dk parçalara böl, kanıtı 'Kanıt:' commit'iyle. Zamanlanmış görev KURMA. Kendi arka plan işin sürerken rapor vermeden BİTİRME (işi ön planda, süre sınırıyla koş).

## Hazırlık
1. Kendi ağacında (kendi commit'in YOKKEN) `git reset --hard t251-wk21`; `git log --oneline -1` ile doğrula (c774eeea); değilse DUR.
2. ÖNCE oku: `CLAUDE.md` (dersler; özellikle 5, 6, 7, 13, 16, 22, 31, 40, 43, 44, 45, 52, 54, 55 ve 'WHATSAPP SÜRENLER'), `docs/BAGIMSIZ-DOGRULAMA-PRENSIBI.md`; KARAR GİRDİSİ `/home/user/ofis---y-netimi/docs/devir/2.5.1-DEVAM/c5c2-kararlar.md` (TEK yeni karar kaynağın — ana ağaçtan oku, kopyalama; §1.1, §2, §4); gerekirse bir önceki girdi `c5c-kararlar.md` ve onaylı ilke taslağı `docs/devir/C5C-ILKE-TASLAK.md`; kâhinin `test/bagimsiz/whatsapp-248/README.md`'si (BÜYÜK — python ile başlıklarını çıkar; güncel kurallar dizinini ve '26. Kâhin güncellemesi 21' bölümünün TAMAMINI oku — özellikle 26.4, 26.7, 26.11, 26.12; düzenli ifadeli grep uzun satırlarda takılır).

## İş (sırayla)
0. KURAL BAŞINA YORUM (README'ye yeni '27. Kâhin güncellemesi 22 — S-W21-1 / 2 / 3 = A (2.5.1)' bölümü; KODDAN ÖNCE, commit): üç kararın her biri için güncelleme 21'de bugün ne var (`secenek` / `ValueError` / iki okuma yaprağı), ne değişecek, hangi beklenti değişir (eski → yeni, nedeni karar numarasıyla). Karar metninin kapsamadığı yeni alt durum çıkarsa KODLAMA — 'KULLANICIYA SORULMALI' (hepsi birlikte).
1. MODEL: S-W21-1 = A — Sonucu Belirsiz işte Yine de Gönder anında söz sürüyorsa elle seçim sayılır, onayda 'Ödeme Sözü Var', ileti gönderim anındaki (elle) tutarla gider; aynı kural bekleyen belirsizlik onaylı işte söz verilip asıl işte yeniden basılınca. S-W21-2 = A — elle iz yalnız işaretlendiği andaki etiket(ler)i aşar; sonradan doğan etiketle gönderim anında 'Atlandı — <etiket>'; başlatmada iki etiket birlikte → ikisi birlikte aşılır. S-W21-3 = A — 2. denemeden önce elle sayılan iş 2. denemede gönderim anındaki şüphesiz tutarla yeniden hazırlanır; elle iz değişmediyse 5.2 aynen. `secenek` / `ValueError` yaprakları TEK okumaya iner; Devri Geri Al sonrası iş ADI iki okumalı kalır (girdi §2).
2. SENARYOLAR: girdi §4'ün WhatsApp satırındaki her sınıf için EN AZ bir elle senaryo; beklenenler ELLE (hesap yorumda). Güncelleme 21'in rastgele üreticisine S-W21-1 / S-W21-2 sınıfları (Yine de Gönder, çapraz etiket, iki etiketli kişi) eklenir — 26.11'in son maddesi artık kodlanabilir; değişmezler: aynı şirkette aynı cariye aynı gün en çok bir Ödeme Hatırlatma (onaylı Yine de Gönder / 'Daha Önce Gönderildi' dışında); elenen her kişinin bir yolu var (ilke 4); kesin almayan 'almış' sayılmaz (ilke 1).
3. ÖZ TEST + MUTASYON: her kararın tersi bir mutant (S-W21-1 B davranışı; elle iz bütün etiketleri aşsın; elle iz sonradan gelen etiketi de aşsın yalnız birini aşsın; 2. deneme donmuş içerikle; elle iz değişmemişken 2. deneme yeniden hazırlansın) — her biri en az bir testte kırmızı. Yeni mutantları ayrı koş; tam mutasyonu EN SONDA bir kez (iki saat dilimi AYRI arka plan işleri, her biri kendi sınırıyla — ders 55).
4. G3 (taban t251-wk21 ↔ yeni): var olan senaryoların beklenenlerinde değişen HER satır (özellikle `secenek` yaprakları ve S23-04 / S29-03) nedeniyle; beklenmeyen değişiklik 0.
5. SÜRÜCÜ İÇİN (README'ye): değişen olayların / çıktıların sözleşmesi (kâhin tarafı). Sürücüye DOKUNMA.

{kurallar('wk22', '`test/bagimsiz/whatsapp-248/README.md`, `test/bagimsiz/whatsapp-248/kahin/**`')}

{RAPOR}
"""

KC32 = f"""Sen DestekOfis projesinde CARİ KÂHİNİ BAKIMI 32 ajanısın (2.5.1 Ç5-C — Ödeme Hatırlatma KİME / HANGİ TUTAR + yeni taksit kartı + KİLİT SINIRINDA BAĞ; PARA ÇEKİRDEĞİNİN kâhini; kodu görmeyen temiz oda modeli; eforun high). Bakım 31 başka ajanla YARIM bitti (dal ucu etiketi t251-kc31-yarim); sen temiz bağlamla onun üç sorusunun kullanıcı yanıtlarını, 2.5.0'dan kalan kilit sınırı kuralını (madde 28 = A, 2.5.1'de S-T4-1 = A ile netleşti) ve bakım 31'in koşulmamış işlerini yaparsın. {ORTAK_YASAK} WhatsApp kâhini (`test/bagimsiz/whatsapp-248/`) ve `docs/whatsapp/**` da OKUNMAZ. Programla karşılaştırma koşusu SENİN işin DEĞİL (ana oturum yapar). Yanıtın Türkçe. KENDİ dalında commit edersin; PUSH YOK. Her bitmiş adımı HEMEN commit et; koşuları ≤ 40 dk parçalara böl, kanıtı 'Kanıt:' commit'iyle. Zamanlanmış görev KURMA. Kendi arka plan işin sürerken rapor vermeden BİTİRME (işi ön planda, süre sınırıyla koş).

## Hazırlık
1. Kendi ağacında (kendi commit'in YOKKEN) `git reset --hard t251-kc31-yarim`; `git log --oneline -1` ile doğrula (0c4237a1); değilse DUR. Bakım 31'in tabanı t251-m2-taban (0e96418a) — G3 tabanın o.
2. ÖNCE oku: `CLAUDE.md` (dersler; özellikle 5, 6, 7, 13, 16, 22, 31, 40, 43, 44, 52, 53, 54, 55), `docs/BAGIMSIZ-DOGRULAMA-PRENSIBI.md`; KARAR GİRDİSİ `/home/user/ofis---y-netimi/docs/devir/2.5.1-DEVAM/c5c2-kararlar.md` (TEK yeni karar kaynağın — ana ağaçtan oku, kopyalama; §1.2, §1.3, §2, §3, §4); gerekirse bir önceki girdi `c5c-kararlar.md` ve onaylı ilke taslağı `docs/devir/C5C-ILKE-TASLAK.md`; kâhinin `test/bagimsiz/cari/KARARLAR.md`'si (ÇOK BÜYÜK — python ile başlıklarını çıkar; güncel kurallar dizinini, 'Bakım 31' bölümünün TAMAMINI, tek borç sırası / bağ önceliği / bağsız ödemenin dağılımı (S2, S6, madde 23 / 24 karşılıkları), dönem kilidi (`donem_kilitle`, S134), taksit kartının açma sınırı (S260, S118, S131, S135) ve Ödeme Sözü bölümlerini oku; düzenli ifadeli grep uzun satırlarda takılır).

## İş (sırayla)
0. KURAL BAŞINA YORUM (KARARLAR.md'ye yeni 'Bakım 32 (2.5.1 Ç5-C + kilit sınırında bağ)' bölümü; KODDAN ÖNCE, commit): SK-56 / SK-57 / SK-58 = A ve madde 28 = A + S-T4-1 = A için modelde bugün ne var, ne değişecek, hangi eski beklenti değişir (eski → yeni, nedeni karar numarasıyla). Girdi §1.3'teki BAŞ MİMAR OKUMASI'nı DEĞERLENDİR (karar metnine uyuyor mu; uymuyorsa nedeniyle yaz, KODLAMA). S134 (= C, BİLİNEN SINIR: kilitli dönemde netleşmiş borç ↔ alacak, kilitten SONRAKİ BAĞSIZ tahsilat) bu kuralın alanı DEĞİL — madde 28 yalnız kilitten sonraki BAĞLI tahsilat / mahsup / iade / kart tahsilatı içindir; ikisinin sınırını yorumda göster, S134 alanının beklentisi DEĞİŞMEZ. Karar metninin kapsamadığı alt durum (örn. kilit anında kısmen açık hedef, aynı gün, kilidin kaldırılıp yeniden konması, bağın sonradan silinmesi) iki okumaya izin veriyorsa KODLAMA — 'KULLANICIYA SORULMALI' (hepsi birlikte, sayılarla).
1. MODEL: SK-56 = A, SK-57 = A, SK-58 = A (bakım 31'de susan / iki okumalı yaprakları tek davranışa); madde 28 = A + S-T4-1 = A — kilitten sonraki bağ, hedefin KİLİT ANINDAKİ GERÇEK durumda (kilitli dönemin kayıtları, bağsız ödemeler kendi tarihlerinde; sonraki bağ yokken) açık kalan kısmını kapatır, fazlası bağsız ödeme gibi dağılır; kilit kaldırılınca bağ önceliği (madde 24) geri gelir. Var olan kural zaten karşılıyorsa DOKUNMA, denetimini göster.
2. SENARYOLAR: girdi §4'ün cari satırındaki her sınıf için EN AZ bir elle senaryo; beklenenler ELLE (model koşulmadan, hesap yorumda) — S-T4-1 sorusunun örneği AYNEN (280,00 / 1.245,40, gecikmiş 280,00, bakiye 1.525,40 — kayıtları sorunun metninden kur) ve 2B-S2'nin F1 / F2 / F3 örneği (11.01'de gecikmiş 0). Rastgele üreticiye kilit + kilitten sonraki bağ sınıfı (tohumlu) + değişmezler: bağ, kilitli dönemin bağsız kapanışını kaydırmaz (kilitli dönemdeki her kalemin kilit anındaki kalanı, kilit sonrası bağlardan bağımsız); kalemler toplamı = bakiye.
3. ÖZ TEST + MUTASYON: her yeni kuralın tersi bir mutant (bağ kilitli bağsız kapanışı kaydırsın; kilit kaldırılınca da kural sürsün; fazla bağsız değil hedefin sonraki kalemine; SK-56 B; SK-57 900 sınırı; SK-58 yeni kart açık borcu taşımasın) — her biri en az bir testte kırmızı. Yeni mutantları ayrı koş; TAM mutasyonu EN SONDA bir kez (iki saat dilimi AYRI arka plan işleri, her biri kendi sınırıyla — ders 55).
4. BAKIM 31'İN YARIM KALANLARI (girdi §3): son koddan sonra TAM öz test iki TZ; G3 taban t251-m2-taban ↔ yeni (bakım 31 + 32'nin değişen HER beklentisi nedeniyle; beklenmeyen 0); yapım aşaması listesi kendi üretici komutunla yeniden üretilir (içeriğini programla KARŞILAŞTIRMA — ana oturumun işi; eski ↔ yeni farkı: yeni / kapanan / değeri değişen sayıları); KARARLAR.md'de bakım 31 + 32'nin kanıt bölümü (koşu adı, sayılar, commit).
5. SÜRÜCÜ İÇİN (KARARLAR.md'ye): kilit sınırında bağ ve alıcı işlevinin değişen çıktılarının sözleşmesi (kâhin tarafı). Sürücüye DOKUNMA.

{kurallar('kc32', '`test/bagimsiz/cari/**`')}

{RAPOR}
"""

for ad, metin in (('c5c2-kararlar.md', KARARLAR), ('wk22-istem.txt', WK22), ('kc32-istem.txt', KC32)):
    open(D + ad, 'w', encoding='utf-8').write(metin)
    print(ad, len(metin))
