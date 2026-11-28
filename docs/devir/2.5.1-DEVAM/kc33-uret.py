#!/usr/bin/env python3
# CARİ KÂHİNİ BAKIMI 33: karar girdisi kc33-kararlar.md + görev metni kc33-istem.txt. Kullanıcı kararları iş listesinden AYNEN çekilir. Ana oturum, 28.11.2026.
D = '/home/user/ofis---y-netimi/docs/devir/2.5.1-DEVAM/'
IS = open('/home/user/ofis---y-netimi/docs/2.5.1-IS-LISTESI.md', encoding='utf-8').read()
SP = '/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad'

def satir(anahtar, metin=IS):
    i = metin.find(anahtar); assert i >= 0, anahtar
    assert metin.find(anahtar, i + 1) < 0, 'tekil değil: ' + anahtar
    b = metin.rfind('\n', 0, i) + 1; e = metin.find('\n', i)
    return metin[b:e].strip()

SK59 = satir('SK-59 (cari kâhini bakımı 32')
SK60 = satir('SK-60 (cari kâhini bakımı 32')
Q2 = satir('S-DKM2-2 (dar kontrol M2 ORTA-2')
Q3 = satir('S-DKM2-3 (dar kontrol M2 ORTA-3')
YETKI = satir('KULLANICI KARARI 27.11 20:26 UTC (AYNEN: "bir süre ekran başında olmayacağım')

KARARLAR = f"""# CARİ KÂHİNİ BAKIMI 33 — KARAR GİRDİSİ (2.5.1; ana oturum yazdı, 28.11.2026)

Bu dosya bu bakımın TEK yeni karar kaynağıdır (CLAUDE.md ders 5, 40, 43). Önceki girdiler (`c5c-kararlar.md`, `c5c2-kararlar.md`) ve kâhinin kendi KARARLAR.md'si AYNEN geçerlidir.
Aşağıdaki soru metinleri iş listesinden AYNEN alınmıştır; içlerindeki "bugün … reddediliyor / kabul ediliyor", "v2.5.0'da …", "eski kod …" cümleleri programın DAVRANIŞININ
ÖLÇÜMÜDÜR — kural kaynağı DEĞİLDİR; kural, satır başındaki "YANITLANDI … = X" ile seçilen şıktır. Bir kuralın iki okuması çıkarsa KODLAMA — raporda "KULLANICIYA SORULMALI".

## 0. Yanıtların dayanağı (AYNEN)
Kullanıcı ekran başında değilken soruları öneriyle yanıtlama yetkisi verdi; aşağıdaki üç yanıt bu yetkiyle uygulanan ÖNERİLERDİR (kullanıcı dönünce değiştirebilir — değişirse sonraki bakımda işlenir):
{YETKI}

## 1. Yeni kararlar
### 1.1 SK-59 = A (bakım 32'nin sorusu — kâhin bugün SUSUYOR)
{SK59}

### 1.2 S-DKM2-2 = A (Değersiz Alacak'tan sonra faturanın iptali / iadesi)
{Q2}
KÂHİNE DÜŞEN: Değersiz Alacak satırı yazılmış bir caride, sonucu cariyi Değersiz yüzünden eksiye düşürecek fatura İPTALİ ve İADESİ — İKİSİ DE — reddedilir (ret kümesi: tür + neden kodu; ileti metni kâhinin işi değil). Değersiz satırı silinince aynı işlem geçer. Kararın söylemediği komşu yollar (fatura TUTARININ düşürülmesi; faturaya bağlı evrakın karşılıksız / iade olması) için kuralın iki okuması çıkarsa KODLAMA — KULLANICIYA SORULMALI.

### 1.3 S-DKM2-3 = C (başka şüpheli kaydın silinmesi — BİLİNEN SINIR)
{Q3}
KÂHİNE DÜŞEN: bu sınıfta kâhin SUSAR (BİLİNEN SINIR — programın davranışı kalır, kâhin denetlemez); susma kodu açıkça yazılır.

### 1.4 SK-60 = C (kilitli dönemde netleşmiş faturaya sonradan bağ — BİLİNEN SINIR; bakım 32'de zaten susuyor)
{SK60}

## 2. Bakım 32'den kalanlar (ana oturumun listesi; 20.11 kuralı — programı etkilemeyenler kovalanmaz)
- DENENMEYEN → bu bakımda: Mahsup Et ile gelen bağın kilit sınırı (madde 28 + S-T4-1 = A kararının metni "faturaya bağlı tahsilat / mahsup" der — kâhinin dilinde mahsup bağı yoksa dil adımı eklenir); S255 ve S234 yollarında kilit sınırı (elle senaryo); karşılıksız dönen ≤ L evrak ile > L bağ; kilitliyken ≤ L tarihli kayıt girme / silme; Tablodan Aktar ve satış kartlarında SK-58; iki şirket.
- SONRAKİ SÜRÜME (dokunma): d64 / d65 dosya adlarındaki 'sus'; G3 aracının mekanik sayacı; öz test §12'nin borç tarafı.
"""

ORTAK_YASAK = ("Programın KODUNU GÖRMEZSİN: `server/`, `client/`, `tools/` (yalnız `tools/kanit.mjs` ÇALIŞTIRILIR), `bulut/`, programın `test/*.test.mjs` dosyaları, "
               "`test/e2e/`, `test/mutabakat/`, öbür kâhinler ve sürücüleri, `docs/kanit/` (kendi kanıtların dışında), `docs/2.5.0-IS-LISTESI*`, `docs/2.5.1-IS-LISTESI*`, "
               "`docs/devir/2.5.0-DEVAM/` ve `docs/devir/2.5.1-DEVAM/` (bu görevin KARAR GİRDİSİ `kc33-kararlar.md` ve önceki girdiler `c5c-kararlar.md`, `c5c2-kararlar.md` hariç; "
               "`pc5c-*`, `d3*`, `m2*`, `dk-*` dosyaları KESİNLİKLE okunmaz), `docs/erp/*-TASARIM.md`, yapım aşaması listesinin içeriği (yalnız üretici komutu çalıştırılır) "
               "ve git geçmişi (yalnız kendi commit'lerin).")

KC33 = f"""Sen DestekOfis projesinde CARİ KÂHİNİ BAKIMI 33 ajanısın (2.5.1; PARA ÇEKİRDEĞİNİN kâhini; kodu görmeyen temiz oda modeli; eforun high). Bakım 32 başka ajanla bitti (dal ucu etiketi t251-kc32); sen temiz bağlamla YALNIZ bu bakımın girdisini işlersin (ders 46). {ORTAK_YASAK} WhatsApp kâhini (`test/bagimsiz/whatsapp-248/`) da OKUNMAZ. Programla karşılaştırma koşusu SENİN işin DEĞİL (ana oturum yapar). Yanıtın Türkçe. KENDİ dalında commit edersin; PUSH YOK. Her bitmiş adımı HEMEN commit et; koşuları ≤ 40 dk parçalara böl, kanıtı 'Kanıt:' commit'iyle. Zamanlanmış görev KURMA. Kendi arka plan işin sürerken rapor vermeden BİTİRME (işi ön planda, süre sınırıyla koş).

## Hazırlık
1. Kendi ağacında (kendi commit'in YOKKEN) `git reset --hard t251-kc32`; `git log --oneline -1` ile doğrula (f8ccd96e); değilse DUR. G3 tabanı t251-kc32.
2. ÖNCE oku: `CLAUDE.md` (dersler; özellikle 5, 6, 7, 13, 16, 22, 31, 40, 43, 44, 52, 53, 54, 55), `docs/BAGIMSIZ-DOGRULAMA-PRENSIBI.md`; KARAR GİRDİSİ `/home/user/ofis---y-netimi/docs/devir/2.5.1-DEVAM/kc33-kararlar.md` (TEK yeni karar kaynağın — ana ağaçtan oku, kopyalama); gerekirse önceki girdiler `c5c2-kararlar.md`, `c5c-kararlar.md`; kâhinin kendi KARARLAR.md'si (başlıklar, bakım 30 — Değersiz Alacak, bakım 31 / 32 bölümleri) ve kural kitabı `docs/erp/MUHASEBELESTIRME-KURAL-KITABI-EK-2B.md` (madde 24, 28 ve şüpheli / Değersiz maddeleri).

## İş (sırayla)
0. KURAL BAŞINA YORUM (KARARLAR.md'ye yeni 'Bakım 33' bölümü; KODDAN ÖNCE, commit): girdi §1.1–1.4 için modelde bugün ne var, ne değişecek, hangi eski beklenti değişir (eski → yeni, karar numarasıyla).
1. MODEL: SK-59 = A; S-DKM2-2 = A (iptal ve iade reddi — ret kümesi; Değersiz satırı silinince geçer); S-DKM2-3 = C (susma, açık kodla); girdi §2'nin DENENMEYEN maddeleri (Mahsup Et bağı dahil).
2. SENARYOLAR: her yeni kural için EN AZ bir elle senaryo; beklenenler ELLE (model koşulmadan, hesap yorumda) — SK-59'un S135 örneği AYNEN (F 600 + X 300 + taksitli B 300, elle kart 900, karta 300 tahsilat → F açığı 300, X 300 açık) ve S-DKM2-2'nin örneği AYNEN (Fatura 2.900 + Borç 3.400; 17.09 bağlı tahsilat 2.876,45; Şüpheliye Al 3.000; Değersiz 3.000 @17.09; sonra iptal → RET, iade → RET; Değersiz silinince iptal geçer).
3. ÖZ TEST + MUTASYON: her yeni kuralın tersi bir mutant (iade kabul edilsin; iptal kabul edilsin; SK-59 B okuması; S-DKM2-3 sınıfında susma kalksın; mahsup bağı kilit sınırını görmesin) — her biri en az bir testte kırmızı. Yeni mutantları ayrı koş; TAM mutasyonu EN SONDA bir kez (iki saat dilimi AYRI arka plan işleri, her biri kendi sınırıyla — ders 55).
4. G3 t251-kc32 ↔ yeni (değişen her beklenti nedeniyle; beklenmeyen 0); yapım aşaması listesi kendi üretici komutunla yeniden üretilir (içeriğini programla KARŞILAŞTIRMA — ana oturumun işi; eski ↔ yeni farkı: yeni / kapanan / değeri değişen sayıları).

## Kurallar
- YAZABİLECEĞİN: yalnız `test/bagimsiz/cari/**` ve `docs/kanit/<bugünün tarihi>/kc33-*`. Başka her şey YASAK.
- Koşular `KANIT_DIR=<not defterin> node tools/kanit.mjs kos kc33-<ad> -- <komut>` (iki saat dilimi: TZ=UTC ve TZ=Europe/Istanbul); ölçüm DIŞI HER koşu `flock -s -w 3600 {SP}/olcum.lock timeout -k 5 <sn> <komut>` altında (süre sınırı flock'un İÇİNDE). Not defterin BENZERSİZ: `{SP}/kc33-<kısa>/`. Arka plan koşusu en çok 2 saat; sınır, adımların ölçülmüş süresinin toplamı × 1,5'ten küçük olmasın; sınıra takılan parça BELİRSİZ, yalnız o parça yeniden koşulur (ders 55). Önce `cat /proc/loadavg`, 4'ün üstündeyse tek seferlik bekle. GIT_DIR / GIT_WORK_TREE VERME. `pkill` / joker `rm` YOK. Tam `npm test` YOK. Disk 5 GB'ın altına düşmez. Commit'e yalnız kendi yolların (`git add <yol>`).
- Kâhin programa UYDURULMAZ (ders 40): kural yalnız karar girdisinden ve kâhinin kendi belgesinden. Kural başına yorum KODDAN ÖNCE commit'lenir.
- 20.11 KURALI (kullanıcı AYNEN: "yapılan işlerde döngüye girmeyelim detaylara boğulup, programı yada kullanıcıyı etkileyemem hususları 2.5.1 sürümüne bırakalım"): programın davranışını / sayılarını / kullanıcının gördüğünü DEĞİŞTİRMEYEN iç hususlar kovalanmaz — raporda 'SONRAKİ SÜRÜME'.
- Commit iletisi sonunda TAM olarak (model adı HİÇBİR yerde yazılmaz):
  Co-Authored-By: Claude <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01EhegDvmPQ9hx2ibfitm6og

## Rapor (son iletin; Türkçe; kısa cümle, madde, tablo)
Özet; kural başına yorum; her sınıf için elle beklenen sonuçlar (tablo); öz test + mutasyon sayıları (iki TZ); G3 (beklenmeyen 0); yapım aşaması listesi farkı; KULLANICIYA SORULMALI (iki seçenek + öneri, sayılarla; uç durumsa 'Uç durum böyle kalsın (BİLİNEN SINIR)'; 'yaygın programlarda' — okunmadıysa 'okunmadı'); SONRAKİ SÜRÜME; DENENMEYEN; okunan dosyaların listesi (bağımsızlık denetimi için); değişen yollar; commit listesi; dal ucu; ana oturumun yeniden koşacağı komutlar (her biri tek satır, süresiyle).
"""

for ad, metin in (('kc33-kararlar.md', KARARLAR), ('kc33-istem.txt', KC33)):
    open(D + ad, 'w', encoding='utf-8').write(metin)
    print(ad, len(metin))
