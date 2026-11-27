#!/usr/bin/env python3
# Muhasebe kâhini devir bakımı 3 (K-D 3): karar girdisi kd3-kararlar.md + görev metni kd3-istem.txt. Kullanıcı kararları iş listesinden AYNEN çekilir. Ana oturum, 27.11.2026.
D = '/home/user/ofis---y-netimi/docs/devir/2.5.1-DEVAM/'
IS = open('/home/user/ofis---y-netimi/docs/2.5.1-IS-LISTESI.md', encoding='utf-8').read()
IS250 = open('/home/user/ofis---y-netimi/docs/2.5.0-IS-LISTESI.md', encoding='utf-8').read()
SP = '/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad'

def satir(anahtar, metin=IS):
    i = metin.find(anahtar); assert i >= 0, anahtar
    b = metin.rfind('\n', 0, i) + 1; e = metin.find('\n', i)
    return metin[b:e].strip()

def parca(anahtar, bas, son, metin=IS):
    s = satir(anahtar, metin); a = s.find(bas); assert a >= 0, bas
    b = s.find(son, a) if son else len(s); assert b > a, son
    return s[a:b].strip()

K_1816 = satir('KULLANICI KARARI 27.11 18:16 UTC').split(' UYGULAMA (baş mimar')[0]
Q_SKD23 = satir('S-KD2-3 (muhasebe kâhini devir bakımı 2')
K_1616 = satir('KULLANICI KARARI 27.11 16:16 UTC').split(' UYGULAMA (baş mimar')[0]
Q_SUR1 = satir('S-SUR-1 (R-1)')
Q_SUR2 = satir('S-SUR-2 (P-1)')
K_1523 = satir('KULLANICI KARARI 27.11 15:23 UTC').split(' UYGULAMA (baş mimar')[0]
Q_UZ1 = satir('S-UZ-1: devirle yeni yıla')
UZMAN = parca('KULLANICI SORUSU 27.11 15:21 UTC', 'uzmanın sekiz kabul ölçütü', ' YANIT (plan')
UZ_EKSIK = parca('KULLANICI SORUSU 27.11 15:21 UTC', '(1) uzmanın ilk kabul testi', ' (6) Devir Raporu')
BM56 = parca('BAŞ MİMAR KARARI 27.11 10:04 UTC', 'BM-5 (', 'BM-7 (')
K220 = parca('KULLANICI KARARI 20.11 13:39 UTC', '(1) S220 = A', ' (2) WHATSAPP', IS250)
KD2_SONRA = parca('BAŞ MİMAR KARARI 27.11 18:15 UTC', 'SONRAYA (', None)

KARARLAR = f"""# MUHASEBE KÂHİNİ DEVİR BAKIMI 3 (K-D 3) — KARAR GİRDİSİ (2.5.1; ana oturum yazdı, 27.11.2026)

Bu dosya bu bakımın TEK yeni karar kaynağıdır (CLAUDE.md ders 5, 40, 43). Önceki iki bakımın girdileri (`kd-kararlar.md`, `kd2-kararlar.md`) AYNEN geçerlidir. Aşağıdaki
kullanıcı kararları ve soru metinleri iş listesinden AYNEN alınmıştır; içlerindeki "program bugün … veriyor", "programın bugünkü davranışı", "v2.5.0'ın gerçek kodu" gibi
cümleler programın DAVRANIŞININ ÖLÇÜMÜDÜR — kural kaynağı DEĞİLDİR; kural, satır başındaki "YANITLANDI … = X" ile seçilen şıktır. Bir kuralın iki okuması çıkarsa KODLAMA —
raporda "KULLANICIYA SORULMALI" (TOPLU KÂHİN BAKIMI: bulduğun bütün alt durumları BİRLİKTE çıkar).

## 1. KULLANICI KARARLARI (AYNEN)

### 1.1 S-KD2-3 = A (bakım 2'nin sorusu — etkin Kural Değişikliği Farkı Düzeltme Fişi varken Kilidi Aç)
{K_1816}
Sorunun metni: {Q_SKD23}
NOT (baş mimar): aynı ileti S-T4-1 = A'yı da verdi; bakım 2'nin KD2-1 (iv) okuması ('Dönem Kilidi K iken yazılmış K sonrası mahsup K öncesi belgeyi ayırmaz') S-T4-1 = A ile AYNI çizgide — kâhinde değişiklik GEREKMEZ, denetimini göster.

### 1.2 S-SUR-1 = B ve S-SUR-2 = A (kâhin ↔ devir planı karşılaştırmasının iki sorusu — kâhin bugün ikisinde de seçilmeyen şıkkı okuyor)
{K_1616}
Soruların metni: {Q_SUR1}
{Q_SUR2}
2.5.0 kararı S220 (vade; AYNEN): {K220}

### 1.3 S-UZ-1 = A (devir açılışları satış / tahsilat / ödeme raporlarına girmez)
{K_1523}
Sorunun metni: {Q_UZ1}

## 2. UZMAN GÖRÜŞÜ — kâhin tarafı (kullanıcı 27.11 15:21 sorusu; baş mimar kararı kullanıcıya gösterildi)
Uzmanın ölçütleri (AYNEN): {UZMAN}
Baş mimarın eksik bulduğu ve KÂHİNE düşenler (yalnız (1), (4), (5) bu bakımın işi; öbürleri programın): {UZ_EKSIK}

## 3. KÂHİN ↔ DEVİR PLANI KARŞILAŞTIRMASININ KÂHİNE GİRDİLERİ (baş mimar 27.11 15:38 (3); yedi madde)
1. BM-5 ve BM-6 senaryoları (devir saf hesabı tur 1'in baş mimar maddeleri, AYNEN): {BM56}
2. R-1 yanıtı = S-SUR-1 = B (§1.2).
3. P-1 için S220 metni (§1.2) — belge tarihi S-SUR-2 = A.
4. S-KD-1 / 2 / 3 — bakım 2'de işlendi; karşılaştırma bu bakımdan sonra koşacak — denetimini göster.
5. Kalemsiz iadenin MİKTARI: programda iade asıl satırdan MİKTARLA seçilir ve stoğa döner; kâhinin 'kalemsiz iade'si bugün MİKTARSIZ → karşılaştırma stok miktarını ölçemiyor. İstenen: kâhinin iade dilinde (isteğe bağlı) miktar; verilirse stok miktarı ve değeri kâhinde de hesaplanır (verilmezse bugünkü gibi).
6. Rastgele üreticinin sıralaması: üretici K ÖNCESİ bir olayı K SONRASI bir olaydan SONRA yazabiliyor (karşılaştırmayı yürüten araç saati geri alamıyor) → üretici olayları tarih sırasıyla yazsın (ya da 'geriye tarihli giriş' ayrı, açık bir sınıf olsun).
7. (BM-6'nın kâhin tarafı) ödeme rolündeki açık kalem yeni yılda ödeme satırı olarak ve asıl vadesiyle — ayrı sınıf.

## 4. BAKIM 2'DEN KALANLAR (baş mimar 27.11 18:15)
{KD2_SONRA}

## 5. BU BAKIMDA KODLANMAYAN (yanıt bekleyen soru)
S-T5-1 (bakiyesi 0 caride devir: yeni yılda yapılmış Mahsup Et yüzünden açık satış kalemi + avans — avans net devir satırında mı, ayrı açık kalem mi; bakım 2'deki 'iki kalem devir satırı olmadan' baş mimar okumasıyla devir planının satır biçimi ayrıştı) KULLANICIDA — kâhin bu durumda bugünkü hâliyle kalır; dokunma, raporda 'yanıt bekliyor' diye an.
"""

KD3 = f"""Sen DestekOfis projesinde MUHASEBE KÂHİNİ DEVİR BAKIMI 3 (K-D 3) ajanısın (2.5.1; kodu görmeyen temiz oda modeli; eforun high). Bir önceki devir bakımı (K-D 2) başka bir ajanla bitti (dal ucu etiketi t251-kd2); sen temiz bağlamla YALNIZ bu bakımın girdisini işlersin (ders 46). Programın KODUNU GÖRMEZSİN: `server/`, `client/`, `tools/` (yalnız `tools/kanit.mjs` ÇALIŞTIRILIR), `bulut/`, programın `test/*.test.mjs` dosyaları, `test/e2e/`, `test/mutabakat/`, sürücü klasörü `test/bagimsiz/muhasebe-surucu/`, öbür kâhinler, `docs/kanit/` (kendi kanıtların ve bu kâhinin önceki bakımlarının kanıtı dışında), `docs/2.5.0-IS-LISTESI*`, `docs/2.5.1-IS-LISTESI*`, `docs/devir/D3-D4-TASARIM.md`, `docs/devir/D2-ALTYAPI-TASARIM.md`, `docs/devir/2.5.0-DEVAM/` ve `docs/devir/2.5.1-DEVAM/` (bu görevin üç KARAR GİRDİSİ hariç: `kd3-kararlar.md`, `kd2-kararlar.md`, `kd-kararlar.md`; `sur-*`, `d3*`, `pc5c-*` KESİNLİKLE okunmaz), `docs/devir/C5C-ILKE-TASLAK.md`, `docs/erp/*-TASARIM.md` ve git geçmişi (kendi bakımının commit'leri ve `git diff t251-kd2..HEAD -- test/bagimsiz/muhasebe` dışında) OKUNMAZ. Programla karşılaştırma YOK (ana oturum ve sürücü yapar); iş modelin kendisi, senaryoları, öz testi ve mutasyonu. Yanıtın Türkçe. KENDİ dalında commit edersin; PUSH YOK. Her bitmiş adımı HEMEN commit et; koşuları ≤ 40 dk parçalara böl, kanıtı 'Kanıt:' commit'iyle. Zamanlanmış görev KURMA. Kendi arka plan işin sürerken rapor vermeden BİTİRME (işi ön planda, süre sınırıyla koş).

## Hazırlık
1. Kendi ağacında (kendi commit'in YOKKEN) `git reset --hard t251-kd2`; `git log --oneline -1` ile doğrula (d87d6100); değilse DUR.
2. ÖNCE oku: `CLAUDE.md` (dersler; özellikle 5, 6, 7, 13, 16, 22, 31, 40, 43, 44, 52, 54, 55), `docs/BAGIMSIZ-DOGRULAMA-PRENSIBI.md`; KARAR GİRDİSİ `/home/user/ofis---y-netimi/docs/devir/2.5.1-DEVAM/kd3-kararlar.md` (TEK yeni karar kaynağın — ana ağaçtan oku, kopyalama) + önceki girdiler `kd2-kararlar.md`, `kd-kararlar.md` (değişmedi); kâhinin `test/bagimsiz/muhasebe/README.md`'si (ÇOK BÜYÜK — python ile başlıklarını çıkar; 'Kaynaklar', 'Senaryo dili', 'Model kapsamı', 'Dallar', 'Değişmezler', 'KARAR GEREKİYOR' ve devir bakımlarının bölümleri — ÖZELLİKLE 'Kâhin bakımı K-D 2 (2.5.1)' bölümünün TAMAMI, SONRAYA ve DENENMEYEN'i; düzenli ifadeli grep uzun satırlarda takılır); README'nin 'Kaynaklar'ında sayılan belgelerin girdide adı geçen yerleri (kural kitabı + EK-1 / EK-2 / EK-2B, çekirdek planı §13–§14, `docs/devir/DEVIR-PLANI.md` YALNIZ §0, §1, §4, §8, §11, G2, G3, G7, G13, G14).

## İş (sırayla)
0. KURAL BAŞINA YORUM (README'ye yeni 'Kâhin bakımı K-D 3 (2.5.1)' bölümü; KODDAN ÖNCE, commit): girdinin §1–§4'ündeki HER madde için modelde bugün ne var, ne değişecek, hangi eski beklenti değişir (eski → yeni, nedeni karar numarasıyla). Özellikle: S-SUR-1 = B (POS iadesi iade edilen tahsilatı azaltır, tahsilatın kapattığı fatura o kadar yeniden açılır, KENDİ vadesiyle — kâhin bugün AYRI kalem okuyor) ve S-SUR-2 = A (Borçta Kalsın kartının vadesi gelmemiş kalanı açık kalemde kartın KENDİ belge tarihini taşır — kâhin bugün kapanış günü okuyor; vade S220 = A ile aynı); S-UZ-1 = A (devir açılışları satış / tahsilat / ödeme raporlarının dönem toplamlarına GİRMEZ, ayrı satırda; 03.10 kuralı yalnız Excel'den elle girilen açılışa) — kâhinin rapor dili yoksa en küçük ekle (dönem satış / tahsilat / ödeme toplamı + açılış ayrı); S-KD2-3 = A (etkin düzeltme fişi varken Kilidi Aç REDDEDİLİR — ret kümesine 'önce düzeltme fişini ters kaydedin' nedeni; fiş ters kaydedilince Kilidi Aç geçer). İki okuma çıkarsa KODLAMA — 'KULLANICIYA SORULMALI'.
1. MODEL: §1–§3'ün kuralları; §2 (uzman): ilk kabul testi AYNEN (Aralık fatura 10.000, tahsilat 4.000; 2 Ocak banka tahsilatı 1.000; 5 Ocak devir → açılış 6.000, Ocak tahsilatı 1.000, güncel açık bakiye 5.000, yaşlandırmada faturanın asıl vadesi), stok ürün ürün değişmez (arşiv K miktarı = yeni yıl açılış miktarı ve değeri — yalnız toplam değil), çek / senette alınan ve verilen yön × her durum ayrı sınıf. Var olan kural zaten karşılıyorsa DOKUNMA, yalnız denetimini göster.
2. SENARYOLAR: girdinin her maddesi için EN AZ bir elle senaryo (sınır günleri: K günü, K+1; kilit K'den önce / K'de / yok); beklenenler ELLE (model koşulmadan, hesap yorumda). §3 madde 6: rastgele üretici olayları tarih sırasıyla yazar (geriye tarihli giriş ayrı açık sınıf). §4: rastgele üreticiye S-T2-1; tohum 8 'kuyruk yakınsamadı' kök nedeni (yeniden üret, nedeni yaz; programa dokunan bir şey değilse SONRAKİ SÜRÜME); DENENMEYEN'deki dört sınıf (Devri Yenile × S-T2-1, zincirleme devirde ayırma, Devir Kapanışı'nın POS hesabı düzeyi, kısmi mahsuplu açık kalemin fatura görünümü) için senaryo — kâhinin dili taşımıyorsa en küçük ek, yine de taşınamıyorsa nedeniyle DENENMEYEN.
3. ÖZ TEST + MUTASYON: her yeni kuralın tersi bir mutant (S-SUR-1 A davranışı; S-SUR-2 kapanış günü; devir açılışı Ocak tahsilatına girsin; etkin fiş varken Kilidi Aç geçsin; stok yalnız toplamdan; çek / senet yönü karışsın; kalemsiz iade miktarı stoğa dönmesin; üretici K öncesi olayı K sonrasından sonra yazsın) — her biri en az bir testte kırmızı. Yeni mutantları ayrı koş; TAM mutasyonu EN SONDA bir kez (iki saat dilimi AYRI arka plan işleri, her biri kendi sınırıyla; bakım 2'de bir parça yük altında 40 dk sınırına takıldı — parçaları ölçülmüş süre × 1,5 ile böl — ders 55).
4. G3 (t251-kd2 ↔ yeni): var olan senaryoların beklenenlerinde değişen HER satırın nedeni karar numarasıyla; beklenmeyen değişiklik 0. `uret_beklenen.py` + `--denetle`.
5. SÜRÜCÜ İÇİN (README'ye): değişen / yeni çıktıların sözleşmesi (kâhin tarafı; özellikle POS iadesi, belge tarihi, rapor toplamları, Kilidi Aç reddi, kalemsiz iade miktarı). Sürücüye DOKUNMA.

## Kurallar
- YAZABİLECEĞİN: yalnız `test/bagimsiz/muhasebe/**` ve `docs/kanit/<bugünün tarihi>/kd3-*`. Başka her şey YASAK.
- Koşular `KANIT_DIR=<not defterin> node tools/kanit.mjs kos kd3-<ad> -- <komut>` (iki saat dilimi: TZ=UTC ve TZ=Europe/Istanbul); ölçüm DIŞI HER koşu `flock -s -w 3600 {SP}/olcum.lock timeout -k 5 <sn> <komut>` altında (süre sınırı flock'un İÇİNDE; kilitsiz koşma). Not defterin BENZERSİZ: `{SP}/kd3-<kısa>/`. Arka plan koşusu en çok 2 saat; sınır, adımların ölçülmüş süresinin toplamı × 1,5'ten küçük olmasın; sınıra takılan parça BELİRSİZ, yalnız o parça yeniden koşulur (ders 55). Önce `cat /proc/loadavg`, 4'ün üstündeyse tek seferlik bekle. GIT_DIR / GIT_WORK_TREE VERME. `pkill` / joker `rm` YOK. Tam `npm test` YOK. Disk 5 GB'ın altına düşmez. Commit'e yalnız kendi yolların (`git add <yol>`; `-A` / `-u` / `commit -a` YOK).
- Kâhin programa UYDURULMAZ (ders 40): kural yalnız karar girdisinden ve README'nin saydığı kaynaklardan. Kural başına yorum KODDAN ÖNCE commit'lenir.
- 20.11 KURALI (kullanıcı AYNEN: "yapılan işlerde döngüye girmeyelim detaylara boğulup, programı yada kullanıcıyı etkileyemem hususları 2.5.1 sürümüne bırakalım"): kâhinin iç düzeni / sayaçlar / belge kovalanmaz — 'SONRAKİ SÜRÜME' başlığına.
- Commit iletisi sonunda TAM olarak (model adı HİÇBİR yerde yazılmaz):
  Co-Authored-By: Claude <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01EhegDvmPQ9hx2ibfitm6og

## Rapor (son iletin; Türkçe; kısa cümle, madde, tablo)
Özet; kural başına yorum (ne değişti, girdinin hangi satırından); yeni senaryolar (sınıf → senaryo adı) ve elle beklenen örnekleri; öz test + mutasyon sayıları (iki TZ); G3 (değişen eski beklentiler nedeniyle); KULLANICIYA SORULMALI (iki seçenek + öneri, sayılarla; uç durumsa 'Uç durum böyle kalsın (BİLİNEN SINIR)'; 'yaygın programlarda' — kaynak okunmadıysa 'okunmadı'); sürücü için çıktı sözleşmesi; SONRAKİ SÜRÜME; DENENMEYEN; okunan dosyaların listesi (bağımsızlık denetimi için); değişen yollar; commit listesi; dal ucu; ana oturumun yeniden koşacağı komutlar (her biri tek satır, süresiyle).
"""
for ad, metin in (('kd3-kararlar.md', KARARLAR), ('kd3-istem.txt', KD3)):
    open(D + ad, 'w', encoding='utf-8').write(metin); print(ad, len(metin))
