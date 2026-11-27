#!/usr/bin/env python3
# D4a TUR 1 (devirli dosyanın kuralları — tek borç sırası / defter rotası / şüpheli defter türetmesi DIŞINDAKİ kısım) görev metni: d4a1-istem.txt.
# Kullanıcı ve baş mimar kararları iş listesinden AYNEN çekilir. Ana oturum, 27.11.2026.
src = open('/home/user/ofis---y-netimi/docs/devir/2.5.1-DEVAM/istem-uret.py').read().split('# ---------------------------------------------------------------- P-D')[0]
exec(src)
IS = open('/home/user/ofis---y-netimi/docs/2.5.1-IS-LISTESI.md', encoding='utf-8').read()

def satir(anahtar, metin=IS):
    i = metin.find(anahtar); assert i >= 0, anahtar
    assert metin.find(anahtar, i + 1) < 0, 'tekil değil: ' + anahtar
    b = metin.rfind('\n', 0, i) + 1; e = metin.find('\n', i)
    return metin[b:e].strip()

def parca(anahtar, bas, son, metin=IS):
    s = satir(anahtar, metin); a = s.find(bas); assert a >= 0, bas
    b = s.find(son, a) if son else len(s); assert b > a, son
    return s[a:b].strip()

ZINCIR = satir('TEK BORÇ SIRASI ZİNCİRİ (BAŞ MİMAR KARARI')
NEDEN = satir('KULLANICI KARARI 27.11 11:39 UTC (AYNEN: "devir yapılırken').split(' UYGULAMA SIRASI:')[0]
K_0707 = satir('KULLANICI KARARI 27.11 07:07 UTC (AYNEN: "önerini uygula" — bekleyen dört')
PD = parca('BAŞ MİMAR KARARI 27.11 06:50 UTC (P-D RAPORU', '(3) B-1 (KVKK)', ' (14) PAKETLEME')
K_UZ1 = satir('KULLANICI KARARI 27.11 15:23 UTC').split(' UYGULAMA (baş mimar')[0]
UZ_UYG = parca('KULLANICI KARARI 27.11 15:23 UTC', 'UYGULAMA (baş mimar)', None)
UZMAN = parca('KULLANICI SORUSU 27.11 15:21 UTC', 'uzmanın sekiz kabul ölçütü', ' YANIT (plan')
UZ_EKSIK = parca('KULLANICI SORUSU 27.11 15:21 UTC', 'EKSİK BULUNANLAR', ' SORU: raporların')
KD_OKUMA = parca('BAŞ MİMAR DEĞERLENDİRMESİ 27.11 11:31 UTC', '(3) Arşivde hareketi olan', ' AYRICA:')
SUR5 = parca('BAŞ MİMAR KARARI 27.11 15:38 UTC', '(5) Kâhinin üç boşluğu', ' (6) S220')
KD28 = parca('BAŞ MİMAR KARARI 27.11 18:15 UTC', 'KD2-8 Kilidi Aç', ' SÜRÜCÜ SÖZLEŞMESİ')
T5_DOG = parca('BAŞ MİMAR KARARI 27.11 20:04 UTC', 'DOĞRULANMADI \'devirden sonra', ' Hız:')
K_T51 = satir('KULLANICI KARARI 27.11 20:12 UTC (AYNEN: "bekleyen soruya önerini uygula"').split(' UYGULAMA (baş mimar')[0]
BM_10 = parca('BAŞ MİMAR KARARI 27.11 10:04 UTC', 'BM-2 (alt defter', ' BM-7 (')
K_1958 = parca('KULLANICI KARARI 27.11 19:58 UTC (AYNEN: "gelir tablosu/bilanço işini sonra ki sürüme bırakabiliriz, planlamanı buna göre yap"): Gelir', 'BAŞ MİMAR OKUMASI', ' (4) mali müşavir')
K_KD = satir('KULLANICI KARARI 27.11 11:39 UTC (AYNEN: "devir yapılırken').split(' (II) YENİ İSTEK')[0]

TABAN = 't251-d4a-taban'
D4A1 = f"""Sen DestekOfis projesinde 2.5.1'in D4a TUR 1 kod ajanısın (devir: DEVİRLİ DOSYANIN KURALLARI — birinci yarı; PARA / DEFTER ÇEKİRDEĞİNE YAKIN; eforun high). Devir saf hesabı (D3, tur 1–5) ana dalda: devir PLANI ve ön izlemesi var, devri UYGULAYAN kod YOK (o D4b). Senin işin: devir uygulandıktan SONRA yeni yıl dosyasında programın uyması gereken kuralların, tek borç sırası / defter rotası / şüpheli defter türetmesi DIŞINDA kalan kısmı. Temiz bağlamla yalnız aşağıdaki işler (ders 46). Ölçüt her yerde: DEVİRLİ = DEVİRSİZ (aynı veri devirsiz programda hangi sayıyı veriyorsa devirli dosyada da o sayı).

{hazirlik(taban=TABAN, taban_ne="çalışma dalı + D3 + KDV Özeti küçük tur 1–3 + Değersiz sınırı birleşimi; ana oturum ajanı başlatırken koyar")}
3. Sonra oku: `docs/devir/D3-D4-TASARIM.md` (§1.2, §1.3, §2, §4.3 göç gereksinimi, §4.4 genel kurallar, §4.5, §4.8, §4.10, §4.12, §6.1 D4a satırı), `docs/devir/DEVIR-PLANI.md` (başındaki 2.5.1 OKUMA NOTU + G bölümü), D3 raporları (`docs/devir/2.5.1-DEVAM/d3-rapor.md` BM-2 / BM-6, `d3t2-rapor.md` BM-T2-1 / BM-T2-2, `d3t4-rapor.md` BM-T4-1, `d3t5-rapor.md`, ileti kataloğu `d3t5-iletiler.md`), `docs/erp/C5-ACILIS-TASARIM.md` (açılış düzeni), `docs/erp/MUHASEBELESTIRME-KURAL-KITABI.md` (devir / açılış bölümleri). KOD: `server/lib/devir/**` (plan türleri — DEĞİŞTİRME, yalnız oku), `server/lib/period.mjs`, `server/lib/migrations.mjs`, çek modülü, banka hesapları, KDV rotası, satış / tahsilat / ödeme raporları, Cari Listesi, yazım yolları.

## DOSYA SINIRI (KULLANICI KARARIYLA KURULAN TEK BORÇ SIRASI ZİNCİRİ — AYNEN)
{ZINCIR}
BU TURDA DEĞİŞTİRİLMEZ (yalnız OKU): `server/lib/obligation-queue.mjs`, `server/lib/obligation-input.mjs`, `server/routes/ledger.mjs`, `server/lib/doubtful-gl.mjs`, devir saf hesabı (`server/lib/devir/plan*.mjs`, `preflight.mjs`, `report.mjs`). Bir kural bu dosyalarda değişiklik gerektiriyorsa KODLAMA — raporun 'D4a TUR 2'YE' başlığına (kural + gerekçe + önerilen yer + sınayan testin taslağı). Devri UYGULAYAN kod (kopya, budama, takas) da YOK (D4b): yeni yıl dosyasını testte bir TEST YARDIMCISI kurar — D3 planını ön izlemeden alıp ayrı bir kopyaya yazan, plan satırlarını (vade, belge tarihi) sırasıyla yazan (BM-T2-2) yardımcı `test/fixtures/` altında; ürün koduna girmez, D4b'nin uygulayıcısının yerine geçmez (raporda öyle yazılır).
GÖÇ İZNİ (ortak kurallardaki göç yasağının İSTİSNASI; numaraları ana oturum verdi): 55 = G-1 (çek olayı türüne 'devir'), 56 = G-2 (devir satırını tanıyan dizinli alan — B-3), 57 = G-3 (KDV açılışının dönem boyutu — B-4), 58 = G-4 (arşiv başvurusu tablosu), 59 = G-5 (şüpheli kayıt / kartın devir açılış tutarı). Yalnız şema; mevcut satıra değer YAZMAZ; şema kapısı (BS-7) ve geri yükleme testleri komşudur (ders 10). Bir göç gerekmezse numara ATLANMAZ — kalanlar 55'ten sırayla kayar, raporda yazılır.

## Kararlar (AYNEN)
{K_0707}
{K_KD}
P-D BAŞ MİMAR KARARLARI (AYNEN; kullanıcıya gösterildi): {PD}
{K_UZ1}
UYGULAMASI (AYNEN): {UZ_UYG}
UZMAN GÖRÜŞÜ (kullanıcının sorusu, AYNEN): {UZMAN}
ONDAN ÇIKAN BAŞ MİMAR KARARLARI (AYNEN): {UZ_EKSIK}
MUHASEBE KÂHİNİNİN OKUMALARI (AYNEN; kâhinle program karşılaştırılacak): {KD_OKUMA} {KD28}
KARŞILAŞTIRMA AJANININ BOŞLUKLARI (AYNEN): {SUR5}
D3 TUR 1 (AYNEN): {BM_10}
D3 TUR 5 (AYNEN): {T5_DOG}
{K_T51}
GELİR TABLOSU / BİLANÇO SONRAKİ SÜRÜMDE (AYNEN): {K_1958}
DEVİR NEDEN DURDU (AYNEN — bu turdaki her ret iletisi bu düzenle; D3'ün tek ileti yardımcısını kullanır): {NEDEN}

## İşler
0. NASIL BOZULUR + KISA TASARIM (koddan ÖNCE, commit): `docs/devir/2.5.1-DEVAM/d4a1-tasarim.md` — G-2 alanının hangi tablolarda ve nasıl dolduğu, G-3 / G-5 / BM-2 alt defter yeri (bütün belirsiz hesaplar BİRLİKTE), G-4 başvurusunun hangi bağları taşıdığı; her seçimde 'devirli = devirsiz' nasıl sağlanıyor; bozulma listesi (sıra değiştir, sil + aynı adla yeniden aç, iki şirket, K günü / K+1, kilitli / kilitsiz, yedek geri yükleme, eski sürüm verisi, Şirket Verisini Sıfırla). Açık mimari seçim kalırsa ikisini de yaz, önerini uygula ve raporda 'BAŞ MİMAR DEĞERLENDİRSİN'.
1. GÖÇLER 55–59 (yukarıdaki izinle) + şema kapısı + geri yükleme + eski sürümden zincirleme göç testi (v2.5.0'ın gerçek kodunun ürettiği dosya — ayrı `git worktree add --detach` kopyası).
2. DEVİR TABANI (tasarım §4.4 madde 1): taban ve öncesine HİÇBİR yazım yok — kilit kaldırılsa da; Silinenler'den ≤K kayıt geri alma reddi; Şirket Verisini Sıfırla tabanı korur (B-6); ret iletileri DEVİR NEDEN DURDU düzeniyle. Dönem Kilidi'nin Kilidi Aç ucunun tabanın altına inmemesi defter rotasında → D4a TUR 2'YE (bu turda yalnız tabanın okuyucusu ve yazım reddi).
3. DEVİR SATIRI KORUMASI (G-2; tasarım §4.4 madde 3): normal ekranlar devir satırını düzenleyemez / silemez — bu turun dosya sınırındaki BÜTÜN yazım yolları (cari hareketi, kasa, stok, çek, banka, taksit kartı); her yolun kalıcı testi; yasak dosyadaki yollar listesi → TUR 2'YE.
4. ÇEK / SENET 'devir' OLAYI (G-1): alınan ve verilen yön × her durum (portföy, bankada tahsilde, ciro, karşılıksız…) ayrı test sınıfı (uzman (5)); yeni yılda ekranların durumu doğru gösterdiği.
5. BANKA HESABI açılış tarihi K+1 (tasarım §1.3 'D2 yapmadı → D4'); devirden sonra açılan hesabın kendi açılışı korunur.
6. KDV AÇILIŞI (G-3 / B-4; 190 / 191 / 391 / 360 dönem boyutu): KDV Özeti ve Ocak mahsubu devirli dosyada devirsiz eşdeğeriyle aynı (önceki dönemden devreden 190 dahil); KDV Özeti küçük tur 1–3 kararları (S-M1-1 = B zincir, S-DKM1-1 = A, S-M1K-1 = A, S-M1K2-1 = A) devirli dosyada da tutar.
7. S-UZ-1 = A: satış / tahsilat / ödeme raporları ve Cari Listesi'nin dönem tahsilatı devir açılış satırlarını tanır ve DIŞARIDA bırakır; açılış ayrı satırda; uzmanın kabul testi AYNEN (Aralık 10.000 fatura + 4.000 tahsilat; 2 Ocak 1.000 banka; devir 5 Ocak → açılış 6.000, Ocak tahsilatı 1.000, güncel açık bakiye 5.000; yaşlandırmada faturanın asıl vadesi) — her rapor ekran = PDF = Excel; 03.10 kuralı Excel'den elle girilen açılışta AYNEN. Rapor tek borç sırasını yalnız OKUYORSA bu turda; sıranın kendisi değişmek zorundaysa → TUR 2'YE.
8. STOK (uzman (4)): ürün ürün arşiv K miktarı = yeni yıl açılış miktarı ve değeri (yalnız toplam değil); birim maliyet.
9. ÖDEME SÖZÜ taşınması (karşılaştırma ajanı (5); P-D türetilmiş kuralı) ve CARİ TÜRÜ (kâhin okuması (3)): devirli dosyada programın bugünkü davranışı ölçülür, kâhinin okumasıyla ayrışırsa KODLAMA — 'KULLANICIYA SORULMALI' (ders 43).
10. KİLİT İZİ (tasarım §4.4 madde 5): yeni yıl dosyasında kilit izi yeniden hesaplanır — 'kilitli dönem değişti' yanlış alarmı YOK (test yardımcısının kurduğu dosyada).
11. ARŞİV BAŞVURUSU (G-4) + D3 tur 5 DOĞRULANMADI: devirden sonra yeni yılda eski yıl belgesiyle Mahsup Et / iade bağı / Kapatılacak Fatura — bugün ne oluyor (ölç); başvurunun okunuşu bu turda; bağın tek borç sırasına tutunması (BM-T2-1) → TUR 2'YE.
12. e-BELGE (uzman (7)): devirden önce gönderilmiş ticari e-faturanın KABUL / RED yanıtı devirden sonra gelirse bugünkü davranış (sahte EDM; gerçek servis YOK) ölçülür ve rapora; RED bir açık kalemi geçersiz kılıyorsa KODLAMA — 'KULLANICIYA SORULMALI'. Devir yeni e-Belge isteği ÜRETMEZ değişmezi (uzman (3)) D4b'nin; burada yalnız okuma yolları.
13. S-T5-1 = A: bakiyesi 0 caride avanslı devirde yeni yıl ekstresinin satır biçimi (iki aktarma seçeneğinde) — test yardımcısının kurduğu dosyada ekstre (ekran = PDF = Excel) kararın örneğiyle.

## Kabul
A yeni testler eski kodda (taban) beklenen nedenle kırmızı (NEDENİ yazılır — ders 38), yenide yeşil iki TZ; B DEVİRLİ = DEVİRSİZ: test yardımcısıyla kurulan devirli dosyada D3'ün gerçek veri üreteci (t7, t11, t23 × iki TZ) üzerinde bu turun dokunduğu her yol (raporlar, KDV Özeti, çek, banka, stok, ekstre) devirsiz eşdeğeriyle aynı sayı — fark yalnız 'D4a TUR 2'YE' yazılmış ve tek borç sırasından gelen sınıflarda (o sınıflar ayrı sayaçta, karar numarası / madde adıyla); C şema kapısı, geri yükleme, eski sürüm zincirleme göç yeşil; D mutasyon (her yeni kural için en az bir: taban reddi kalksın, devir satırı düzenlenebilsin, çek devir olayı yanlış duruma düşsün, banka açılış tarihi K olsun, KDV açılış dönemi kaybolsun, rapor açılışı içersin, stok değeri toplamdan dağıtılsın, kilit izi yeniden hesaplanmasın) hepsi yakalanır iki TZ; E komşular (`git grep` ile değişen işlevlerin çağıranları; şema / göç / yedek değişikliğinde şema kapısı + geri yükleme — ders 10) iki TZ yeşil; F ileti kataloğunda (D3'ün katalog üreticisiyle) yeni ret iletilerinde iç kod / İngilizce / tablo adı 0; G HIZ: değişen her yol (raporlar, KDV Özeti, yazım reddi denetimi) öğe başına ağır okuma eklemez (ders 47); ölçemiyorsan 'ÖLÇÜLMEDİ' (ana oturum ölçer).

{KURALLAR_KULLANICI}
KULLANICI KURALI (27.11, AYNEN: "bir süre ekran başında olmayacağım. sorularına baş mimar önerilerini uygula"): senin kodlama iznin DEĞİLDİR — para / defter / kapama kuralı ayrışmasında yine KODLAMA, 'KULLANICIYA SORULMALI' (öneriyle); ana oturum karar verir.

{kurallar('d4a1', taban=TABAN)}

{rapor()}
Rapora AYRICA: 'D4a TUR 2'YE' başlığı (tek borç sırası / defter rotası / şüpheli defter türetmesi gerektiren her kural), 'D4b'YE' başlığı (uygulayıcıya düşenler — test yardımcısının yaptığı ve ürünün yapması gereken), göç numaralarının son hâli.
"""
open('/home/user/ofis---y-netimi/docs/devir/2.5.1-DEVAM/d4a1-istem.txt', 'w', encoding='utf-8').write(D4A1)
print(len(D4A1))
