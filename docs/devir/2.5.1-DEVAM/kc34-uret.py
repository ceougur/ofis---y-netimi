#!/usr/bin/env python3
# CARİ KÂHİNİ BAKIMI 34: karar girdisi kc34-kararlar.md + görev metni kc34-istem.txt. Kullanıcı kararları iş listesinden AYNEN çekilir. Ana oturum, 28.11.2026.
D = '/home/user/ofis---y-netimi/docs/devir/2.5.1-DEVAM/'
IS = open('/home/user/ofis---y-netimi/docs/2.5.1-IS-LISTESI.md', encoding='utf-8').read()
SP = '/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad'

def satir(anahtar, metin=IS):
    i = metin.find(anahtar); assert i >= 0, anahtar
    assert metin.find(anahtar, i + 1) < 0, 'tekil değil: ' + anahtar
    b = metin.rfind('\n', 0, i) + 1; e = metin.find('\n', i)
    return metin[b:e].strip()

Q_M2T21 = satir('S-M2T2-1 (')
Q_M2T22 = satir('S-M2T2-2 (')
Q_DKM2T3 = satir('S-DKM2T3-1 (')
Q_KSEML = satir('S-KSEML-1 (')
Q_SK63 = satir('SK-63 (')
Q_T41K = satir('S-T4-1-K (kilit paketi tur 1')
Q_T41KI = satir('S-T4-1-K-İ (')
Q_SUR1 = satir('S-SUR-1 (R-1)')
YETKI = satir('KULLANICI KARARI 27.11 20:26 UTC (AYNEN: "bir süre ekran başında olmayacağım')

KARARLAR = f"""# CARİ KÂHİNİ BAKIMI 34 — KARAR GİRDİSİ (2.5.1; ana oturum yazdı, 28.11.2026)

Bu dosya bu bakımın TEK yeni karar kaynağıdır (CLAUDE.md ders 5, 40, 43). Önceki girdiler (`c5c-kararlar.md`, `c5c2-kararlar.md`, `kc33-kararlar.md`) ve kâhinin kendi KARARLAR.md'si AYNEN geçerlidir.
Aşağıdaki soru metinleri iş listesinden AYNEN alınmıştır; içlerindeki "bugün … reddediliyor / kabul ediliyor", "v2.5.0'da …", "eski kod …", "program …" cümleleri programın DAVRANIŞININ
ÖLÇÜMÜDÜR — kural kaynağı DEĞİLDİR; kural, satır başındaki "YANITLANDI … = X" ile seçilen şıktır. Bir kuralın iki okuması çıkarsa KODLAMA — raporda "KULLANICIYA SORULMALI".

## 0. Yanıtların dayanağı (AYNEN)
Kullanıcı ekran başında değilken soruları öneriyle yanıtlama yetkisi verdi; aşağıdaki yanıtlar bu yetkiyle uygulanan ÖNERİLERDİR (kullanıcı dönünce değiştirebilir — değişirse sonraki bakımda işlenir):
{YETKI}

## 1. Yeni kararlar
### 1.1 S-M2T2-1 = A (bakım 33'ün SK-62'si — Değersiz olmasa da eksi kalacak iptal / iade)
{Q_M2T21}
KÂHİNE DÜŞEN: bakım 33'te S-DKM2-2 için kurduğun 'Değersiz yüzünden eksi' koşulu (bakiye + Değersiz ≥ 0) KALKAR — Değersiz Alacak satırı olan caride bakiyeyi düşürüp eksiye götüren HER iptal / iade reddedilir.

### 1.2 S-M2T2-2 = A (bakım 33'ün SK-61'i — Düzenle ile tutar düşürme)
{Q_M2T22}
KÂHİNE DÜŞEN: Değersiz satırı olan caride borç yönlü belgenin (satış faturası, SMM, alıştan iade) tutarının Düzenle ile düşürülmesi ya da carisinin değiştirilmesi, sonuç cariyi eksiye götürüyorsa reddedilir (iade gibi). Tutar artışı, eksiye götürmeyen azalış kabul.

### 1.3 S-DKM2T3-1 = A (Borç Yaz satırının silinmesi / düşürülmesi)
{Q_DKM2T3}
KÂHİNE DÜŞEN: Değersiz satırı olan caride Borç Yaz satırının silinmesi ya da tutarının düşürülmesi cariyi eksiye götürüyorsa reddedilir (aynı kural). Taksit kartı silme aynı sınıf — kararın metni 'ölçülür, aynı kuralla' der: kâhinde kart silme de bu kurala girer; iki okuma çıkarsa KULLANICIYA SORULMALI.

### 1.4 S-KSEML-1 = A (Mahsup Et, bağsız tahsilatla kapanmış faturaya)
{Q_KSEML}
KÂHİNE DÜŞEN: Mahsup Et yalnız faturanın bağsız tahsilattan SONRA kalan açığına yapılır; açığı aşan Mahsup Et reddedilir (bu sınıfta kâhin bugün SUSUYORDU — artık ret kümesi: tür + neden).

### 1.5 SK-63 = C
{Q_SK63}

### 1.6 Kilit sınırı (S-T4-1-K = A ve S-T4-1-K-İ = A) — kendi KARARLAR.md'nde yoksa işle
{Q_T41K}
{Q_T41KI}

### 1.7 POS iadesi (S-SUR-1 = B) — kendi KARARLAR.md'nde yoksa işle
{Q_SUR1}
NOT (ölçüm, kural DEĞİL): programın POS İşlemleri › İade yolu bugün ayrı kalem veriyordu; karar B'dir — kâhin karar metnine göre modellenir.

## 2. Senaryo girdileri (sürücü eşlemesi ajanının bulduğu boşluklar)
- Şüpheli alacakta carinin İKİNCİ şüpheli kaydını silen senaryo (`supheli_sil` — bugünkü senaryolar yalnız ilk kaydı siliyor).
- Mahsup Et'in ALIŞ faturası kartından açıldığı senaryo (karşı belge satış faturası).
- Yeni dil adımı GEREKMEMELİ — var olan adımlar (`hareket_sil`, `hareket_duzenle`, `kart_sil`, `fatura_duzenle`, `fatura_iptal`, `iade`, `mahsup`, `degersiz_sil`, `supheli_sil`) yetmiyorsa DUR ve raporda yaz (yeni adımın sürücü eşlemesi ana oturuma kalır).
"""

ORTAK_YASAK = ("Programın KODUNU GÖRMEZSİN: `server/`, `client/`, `tools/` (yalnız `tools/kanit.mjs` ÇALIŞTIRILIR), `bulut/`, programın `test/*.test.mjs` dosyaları, "
               "`test/e2e/`, `test/mutabakat/`, öbür kâhinler ve sürücüleri, `docs/kanit/` (kendi kanıtların dışında), `docs/2.5.0-IS-LISTESI*`, `docs/2.5.1-IS-LISTESI*`, "
               "`docs/devir/2.5.0-DEVAM/` ve `docs/devir/2.5.1-DEVAM/` (bu görevin KARAR GİRDİSİ `kc34-kararlar.md` ve önceki girdiler `c5c-kararlar.md`, `c5c2-kararlar.md`, `kc34-kararlar.md` hariç; "
               "`pc5c-*`, `d3*`, `m2*`, `dk-*` dosyaları KESİNLİKLE okunmaz), `docs/erp/*-TASARIM.md`, yapım aşaması listesinin içeriği (yalnız üretici komutu çalıştırılır) "
               "ve git geçmişi (yalnız kendi commit'lerin).")

KC34 = f"""Sen DestekOfis projesinde CARİ KÂHİNİ BAKIMI 34 ajanısın (2.5.1; PARA ÇEKİRDEĞİNİN kâhini; kodu görmeyen temiz oda modeli; eforun high). Bakım 33 başka ajanla bitti ve programın sürücüsü yeni dil adımlarına eşlendi (dal ucu etiketi t251-kseml); sen temiz bağlamla YALNIZ bu bakımın girdisini işlersin (ders 46). {ORTAK_YASAK} WhatsApp kâhini (`test/bagimsiz/whatsapp-248/`) da OKUNMAZ. Programla karşılaştırma koşusu SENİN işin DEĞİL (ana oturum yapar). Yanıtın Türkçe. KENDİ dalında commit edersin; PUSH YOK. Her bitmiş adımı HEMEN commit et; koşuları ≤ 40 dk parçalara böl, kanıtı 'Kanıt:' commit'iyle. Zamanlanmış görev KURMA. Kendi arka plan işin sürerken rapor vermeden BİTİRME (işi ön planda, süre sınırıyla koş).

## Hazırlık
1. Kendi ağacında (kendi commit'in YOKKEN) `git reset --hard t251-kseml`; `git log --oneline -1` ile doğrula (42a1a74c); değilse DUR. G3 tabanı t251-kseml.
2. ÖNCE oku: `CLAUDE.md` (dersler; özellikle 5, 6, 7, 13, 16, 22, 31, 40, 43, 44, 52, 53, 54, 55), `docs/BAGIMSIZ-DOGRULAMA-PRENSIBI.md`; KARAR GİRDİSİ `/home/user/ofis---y-netimi/docs/devir/2.5.1-DEVAM/kc34-kararlar.md` (TEK yeni karar kaynağın — ana ağaçtan oku, kopyalama); gerekirse önceki girdiler `kc34-kararlar.md`, `c5c2-kararlar.md`, `c5c-kararlar.md`; kâhinin kendi KARARLAR.md'si (başlıklar, bakım 30 — Değersiz Alacak, bakım 31 / 32 / 33 bölümleri) ve kural kitabı `docs/erp/MUHASEBELESTIRME-KURAL-KITABI-EK-2B.md` (madde 24, 28 ve şüpheli / Değersiz maddeleri).

## İş (sırayla)
0. KURAL BAŞINA YORUM (KARARLAR.md'ye yeni 'Bakım 34' bölümü; KODDAN ÖNCE, commit): girdi §1.1–1.7 için modelde bugün ne var, ne değişecek, hangi eski beklenti değişir (eski → yeni, karar numarasıyla); §1.6 / §1.7 zaten işlenmişse 'zaten var — §X' yaz, yeniden işleme.
1. MODEL: §1.1–1.4 (ret kümeleri: tür + neden; ileti metni kâhinin işi değil); §1.5 kararın metnine göre; §1.6 / §1.7 gerekirse.
2. SENARYOLAR: her yeni kural için EN AZ bir elle senaryo; beklenenler ELLE (model koşulmadan, hesap yorumda) — kararların örnekleri AYNEN (S-M2T2-1: 05.10 avans 3.000, fatura 2.900 iptal → RET, bakiye −2.576,45 kalır; S-M2T2-2: 2.900 → 100 RET, bakiye 423,55; S-DKM2T3-1: Borç Yaz 3.400 silme RET, bakiye 423,55; S-KSEML-1: MF1 10.000 bağsız tahsilatla kapanmış, MA 10.000 ile Mahsup Et → RET, MA açık 10.000, MF3 açık 10.000) + girdi §2'nin iki senaryosu.
3. ÖZ TEST + MUTASYON: her yeni kuralın tersi bir mutant ('Değersiz yüzünden' koşulu geri gelsin; tutar düşürme kabul edilsin; Borç Yaz silme kabul edilsin; Mahsup Et açığı aşarken kabul edilsin; ikinci şüpheli kaydın silinmesinde ilk kayıt silinsin) — her biri en az bir testte kırmızı. Yeni mutantları ayrı koş; TAM mutasyonu EN SONDA bir kez (iki saat dilimi AYRI arka plan işleri, her biri kendi sınırıyla — ders 55).
4. G3 t251-kseml ↔ yeni (değişen her beklenti nedeniyle; beklenmeyen 0); yapım aşaması listesi kendi üretici komutunla yeniden üretilir (içeriğini programla KARŞILAŞTIRMA — ana oturumun işi; eski ↔ yeni farkı: yeni / kapanan / değeri değişen sayıları).

## Kurallar
- YAZABİLECEĞİN: yalnız `test/bagimsiz/cari/**` ve `docs/kanit/<bugünün tarihi>/kc34-*`. Başka her şey YASAK.
- Koşular `KANIT_DIR=<not defterin> node tools/kanit.mjs kos kc34-<ad> -- <komut>` (iki saat dilimi: TZ=UTC ve TZ=Europe/Istanbul); ölçüm DIŞI HER koşu `flock -s -w 3600 {SP}/olcum.lock timeout -k 5 <sn> <komut>` altında (süre sınırı flock'un İÇİNDE). Not defterin BENZERSİZ: `{SP}/kc34-<kısa>/`. Arka plan koşusu en çok 2 saat; sınır, adımların ölçülmüş süresinin toplamı × 1,5'ten küçük olmasın; sınıra takılan parça BELİRSİZ, yalnız o parça yeniden koşulur (ders 55). Önce `cat /proc/loadavg`, 4'ün üstündeyse tek seferlik bekle. GIT_DIR / GIT_WORK_TREE VERME. `pkill` / joker `rm` YOK. Tam `npm test` YOK. Disk 5 GB'ın altına düşmez. Commit'e yalnız kendi yolların (`git add <yol>`).
- Kâhin programa UYDURULMAZ (ders 40): kural yalnız karar girdisinden ve kâhinin kendi belgesinden. Kural başına yorum KODDAN ÖNCE commit'lenir.
- 20.11 KURALI (kullanıcı AYNEN: "yapılan işlerde döngüye girmeyelim detaylara boğulup, programı yada kullanıcıyı etkileyemem hususları 2.5.1 sürümüne bırakalım"): programın davranışını / sayılarını / kullanıcının gördüğünü DEĞİŞTİRMEYEN iç hususlar kovalanmaz — raporda 'SONRAKİ SÜRÜME'.
- Commit iletisi sonunda TAM olarak (model adı HİÇBİR yerde yazılmaz):
  Co-Authored-By: Claude <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01EhegDvmPQ9hx2ibfitm6og

## Rapor (son iletin; Türkçe; kısa cümle, madde, tablo)
Özet; kural başına yorum; her sınıf için elle beklenen sonuçlar (tablo); öz test + mutasyon sayıları (iki TZ); G3 (beklenmeyen 0); yapım aşaması listesi farkı; KULLANICIYA SORULMALI (iki seçenek + öneri, sayılarla; uç durumsa 'Uç durum böyle kalsın (BİLİNEN SINIR)'; 'yaygın programlarda' — okunmadıysa 'okunmadı'); SONRAKİ SÜRÜME; DENENMEYEN; okunan dosyaların listesi (bağımsızlık denetimi için); değişen yollar; commit listesi; dal ucu; ana oturumun yeniden koşacağı komutlar (her biri tek satır, süresiyle).
"""

for ad, metin in (('kc34-kararlar.md', KARARLAR), ('kc34-istem.txt', KC34)):
    open(D + ad, 'w', encoding='utf-8').write(metin)
    print(ad, len(metin))
