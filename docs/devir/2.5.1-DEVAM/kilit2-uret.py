#!/usr/bin/env python3
# KİLİT PAKETİ TUR 2 görev metni: kilit2-istem.txt. Kullanıcı / baş mimar kararları iş listesinden AYNEN çekilir. Ana oturum, 28.11.2026.
src = open('/home/user/ofis---y-netimi/docs/devir/2.5.1-DEVAM/istem-uret.py').read().split('# ---------------------------------------------------------------- P-D')[0]
exec(src)
IS = open('/home/user/ofis---y-netimi/docs/2.5.1-IS-LISTESI.md', encoding='utf-8').read()
IS250 = open('/home/user/ofis---y-netimi/docs/2.5.0-IS-LISTESI.md', encoding='utf-8').read()

def satir(anahtar, metin=IS):
    i = metin.find(anahtar); assert i >= 0, anahtar
    assert metin.find(anahtar, i + 1) < 0, 'tekil değil: ' + anahtar
    b = metin.rfind('\n', 0, i) + 1; e = metin.find('\n', i)
    return metin[b:e].strip()

K28 = satir('(3) 2B-S2 / 28 = A:', IS250)
K_1816 = satir('KULLANICI KARARI 27.11 18:16 UTC').split(' UYGULAMA (baş mimar')[0]
K_1616 = satir('KULLANICI KARARI 27.11 16:16 UTC').split(' UYGULAMA (baş mimar')[0]
Q_SUR1 = satir('S-SUR-1 (R-1)')
QK = satir('S-T4-1-K (kilit paketi tur 1')
BM = satir('(KİLİT PAKETİ TUR 1 raporu')
QKD31 = satir('S-KD3-1 (muhasebe kâhini bakımı 3')
NEDEN = satir('KULLANICI KARARI 27.11 11:39 UTC (AYNEN: "devir yapılırken').split(' UYGULAMA SIRASI:')[0]
ZINCIR = satir('TEK BORÇ SIRASI ZİNCİRİ (BAŞ MİMAR KARARI')
TABAN = 't251-kilit-tur1'

KILIT2 = f"""Sen DestekOfis projesinde 2.5.1'in KİLİT PAKETİ TUR 2 kod ajanısın (PARA ÇEKİRDEĞİ: tek borç sırası + Dönem Kilidi; eforun high). Tur 1 başka ajanla bitti (dal ucu etiketi t251-kilit-tur1 = 45d3e3ce; ana dala GİRMEDİ; raporu kendi ağacında `docs/devir/2.5.1-DEVAM/kilit-rapor.md`). Temiz bağlamla YALNIZ aşağıdaki işleri yaparsın (ders 46). Kâhin dosyalarını OKUMAZ, YAZMAZSIN.

{hazirlik(taban=TABAN, taban_ne="kilit paketi tur 1'in dal ucu 45d3e3ce")}
3. Sonra oku: tur 1'in raporu `docs/devir/2.5.1-DEVAM/kilit-rapor.md` (TAMAMI — özellikle §3 kök nedenler, §9, §10, §17 komutlar), farkı `git diff t251-kilit-taban t251-kilit-tur1 -- server client test`; tek borç sırasının kilit izi okuması (yazım anındaki kilit — B12 / S19 düzeni); POS iadesi yolları (POS İşlemleri'nden kısmi / tam iade; tahsilat kartından iade; fatura iadesi) — YALNIZ OKU, sonra işe göre yaz.

## DOSYA SINIRI (TEK BORÇ SIRASI ZİNCİRİ — AYNEN; zincirin İLKİ sensin, tur 1'in sınırı AYNEN)
{ZINCIR}
YAZABİLİRSİN: tek borç sırası ve girdisi, Dönem Kilidi'nin kilit ucu, kural farkı / devir ön denetimi iletilerinin YALNIZ adım metinleri, Dönem Kilidi ekranı ve kayıt / fatura kartında YALNIZ iş 5'in notu, POS iadesinin tek borç sırasına giren tanımı (iş 2 için gerekiyorsa), testler, kanıt, rapor. YAZAMAZSIN: devir saf hesabının hesap kodu (D3 tur 6 şu an devir okuyucusunda çalışıyor — çakışmasın; tur 1'in plan okuyucuya eklediği `etkinFisler` alanı KABUL edildi, başka değişiklik yok), göçler, şüpheli alacak modülü (Değersiz sınırı tur 2 çalışıyor), WhatsApp. Gerekirse DUR → 'BAŞ MİMAR KARARI GEREKİYOR'.

## Kararlar (AYNEN)
2.5.0 KARARI: {K28}
{K_1816}
TUR 1'İN SORUSU VE YANITI (AYNEN): {QK}
S-SUR-1 KARARI (AYNEN): {K_1616}
S-SUR-1 SORUSUNUN METNİ (AYNEN; içindeki 'programın bugünkü davranışı' bir ÖLÇÜMDÜ — tur 1 bunun POS İşlemleri yolunda tutmadığını buldu): {Q_SUR1}
S-KD3-1 (AYNEN): {QKD31}
TUR 1'İN BAŞ MİMAR KARARLARI (AYNEN): {BM}
DEVİR NEDEN DURDU İLETİ DÜZENİ (AYNEN): {NEDEN}

## İşler
0. NASIL BOZULUR (koddan ÖNCE, commit): bağ kilitten önce / sonra YAZILMIŞ × tarihi kilitten önce / sonra × kilit sonradan konmuş / kaldırılmış / geri alınmış / ileri alınmış; karşılıksız çek (S19 — yazım anı AYNEN kalır); POS iadesi kilitsiz / kilitli dönemde, kısmi / tam, tahsilat bağlı / bağsız, her iade yolu; iki şirket; yedek geri yükleme; v2.5.0 verisi.
1. S-T4-1-K = A: bağın kilit sınırı BAĞIN TARİHİ ve GÜNCEL kilitle okunur (yazım anı değil); karşılıksız çek (S19) yazım anında kalır. Tur 1 raporu §9 tablosunun üç satırı kalıcı testte A sütunuyla (bağ kilitten önce yazılmış, kilit sonra konmuş → 280 / 1.245,40; kilit kaldırılınca → 408; kilit 30.06'ya geri alınınca → 408 — üçüncüsünü ÖLÇ). Devir gerçek veri karşılaştırması (3 tohum × 2 TZ) — 'Ocak tahsilatı girildikten sonra Aralık kilidi' sınıfında devirli = devirsiz; açıklanmamış fark 0.
2. S-SUR-1 = B: ÖNCE ÖLÇ (kod değiştirmeden; kanıt): programın canlı (devirsiz) yolunda POS iadesinin her yolu ne veriyor — iade edilen tahsilat azalıp tahsilatın kapattığı fatura kendi vadesiyle mi açılıyor (B), yoksa ayrı kalem mi (A); devir planı aynı veride ne taşıyor. Kararın metni B (kullanıcı kararı); bir yol A veriyorsa o yol B'ye getirilir — kilitsiz dönemde. Kilitli / devredilmiş dönemdeki tahsilatın kilitten sonraki iadesi S-KD3-1 = a'ya göre AYRI KALEM kalır (tur 1 bunu sabitledi — bozulmaz). Değişiklik kilitsiz dönemdeki gecikmiş / açık kalem sayılarını değiştirir: v2.5.0 sınıf karşılaştırmasında 'beklenen farklar' dosyasına karar numarasıyla (S-SUR-1 = B) yazılır; kararın örneği AYNEN kalıcı testte (fatura 3.577,42, POS 189,00, 12.11'de iade 10,00 → fatura 627,63 açık, kendi vadesiyle; 12.11'de gecikmiş 627,63). Kararın söylemediği bir yolda iki okuma çıkarsa KODLAMA — 'KULLANICIYA SORULMALI'.
3. BM (b) + (c): devir ön denetimi ve kural farkı iletilerinin adımları EKRANDAKİ düğme adlarıyla ('Kilidi Kaldır' / 'Kilitle' — ekranda ne yazıyorsa); S-KD-2 iletisinin 'kilidi geriye alın' adımı etkin düzeltme fişi varken önce 'Ters Kaydet' adımını söyler (BM-T5-3 ile aynı düzen).
4. BM (e): satış yönündeki karar (5) netleşmesinin bağsız kapanış sayılması ile ödenecek yönündeki asimetriyi ÖLÇ (iki yön × sınıflar); sayı farkı çıkarsa KODLAMA — 'KULLANICIYA SORULMALI' (öneriyle).
5. BM (d) — madde 28 'program bunu kayıtta yazar': bağlı tahsilatın kilitli dönemde kapanmış faturaya sonradan bağlandığı ve fazlasının bağsız dağıldığı, TAHSİLAT KAYDININ (hareketin) kendisinde ve bağlanan faturanın kartında da görünür (kısa cümle; YAZIM DÜZENİ; ekran = PDF ekstre açıklaması gerekiyorsa).
6. Komşular (tur 1'in 115 dosyalık listesi + bu turun `git grep` taraması) iki TZ; tur 1'in mutasyonu 12 / 12 AYNEN + bu turun en az üç mutantı (bağ yazım anına dönsün; POS iadesi yine ayrı kalem; ileti eski düğme adı); v2.5.0 sınıf karşılaştırması (beklenen farklar dosyası güncel); kâhinler `npm run test:kahin-cari`, `npm run test:kahin-defter` iki TZ (kodunu okumadan) — farkları rapora (kâhinin yeni bakımlarıyla karşılaştırmayı ana oturum yapar).

## Kabul
A yeni / değişen testler tabanda (t251-kilit-tur1) beklenen nedenle kırmızı (NEDEN — ders 38), yenide yeşil iki TZ; B mutasyon hepsi yakalanır iki TZ; C v2.5.0 sınıf karşılaştırması yazılı farklar dışında 0; D devir gerçek veri 3 tohum × 2 TZ — S-T4-1 sayacı 0, açıklanmamış fark 0; E komşular yeşil; F hız: öğe başına ağır okuma eklenmez — ölçemiyorsan 'ÖLÇÜLMEDİ' (ana oturum ölçer: cari kartı, Cari Listesi, Açık Faturalar, devir ön izlemesi, kilit ucu).

{KURALLAR_KULLANICI}
KULLANICI KURALI (27.11, AYNEN: "bir süre ekran başında olmayacağım. sorularına baş mimar önerilerini uygula"): senin kodlama iznin DEĞİLDİR — yeni para / kapama ayrışmasında KODLAMA, 'KULLANICIYA SORULMALI' (öneriyle).

{kurallar('kilit2', taban=TABAN)}

{rapor()}
"""
open('/home/user/ofis---y-netimi/docs/devir/2.5.1-DEVAM/kilit2-istem.txt', 'w', encoding='utf-8').write(KILIT2)
print(len(KILIT2))
