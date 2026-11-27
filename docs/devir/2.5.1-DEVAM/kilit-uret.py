#!/usr/bin/env python3
# KİLİT PAKETİ (S-T4-1 + S-KD2-3) kod turu görev metni: kilit-istem.txt. Kullanıcı kararları iş listelerinden AYNEN çekilir. Ana oturum, 27.11.2026.
src = open('/home/user/ofis---y-netimi/docs/devir/2.5.1-DEVAM/istem-uret.py').read().split('# ---------------------------------------------------------------- P-D')[0]
exec(src)
IS = open('/home/user/ofis---y-netimi/docs/2.5.1-IS-LISTESI.md', encoding='utf-8').read()
IS250 = open('/home/user/ofis---y-netimi/docs/2.5.0-IS-LISTESI.md', encoding='utf-8').read()

def satir(anahtar, metin=IS):
    i = metin.find(anahtar); assert i >= 0, anahtar
    assert metin.find(anahtar, i + 1) < 0, 'tekil değil: ' + anahtar
    b = metin.rfind('\n', 0, i) + 1; e = metin.find('\n', i)
    return metin[b:e].strip()

def parca(anahtar, bas, son, metin=IS):
    s = satir(anahtar, metin); a = s.find(bas); assert a >= 0, bas
    b = s.find(son, a) if son else len(s); assert b > a, son
    return s[a:b].strip()

K28 = satir('(3) 2B-S2 / 28 = A:', IS250)
K_1816 = satir('KULLANICI KARARI 27.11 18:16 UTC').split(' UYGULAMA (baş mimar')[0]
Q_ST41 = satir('S-T4-1 (D3 tur 4 raporu')
Q_SKD23 = satir('S-KD2-3 (muhasebe kâhini devir bakımı 2')
BMT53 = parca('BAŞ MİMAR KARARI 27.11 20:04 UTC', 'BM-T5-3 →', ' BM-T5-4')
OLCUM = parca('BAŞ MİMAR KARARI 27.11 20:04 UTC', 'YENİ ÖLÇÜM → KİLİT PAKETİ GİRDİSİ', ' DOĞRULANMADI')
NEDEN = satir('KULLANICI KARARI 27.11 11:39 UTC (AYNEN: "devir yapılırken').split(' UYGULAMA SIRASI:')[0]
ZINCIR = satir('TEK BORÇ SIRASI ZİNCİRİ (BAŞ MİMAR KARARI')

TABAN = 't251-kilit-taban'
KILIT = f"""Sen DestekOfis projesinde 2.5.1'in KİLİT PAKETİ kod ajanısın (PARA ÇEKİRDEĞİ: tek borç sırası + Dönem Kilidi; eforun high). Temiz bağlamla YALNIZ aşağıdaki iki kararın programdaki karşılığını yaparsın (ders 46). Kodu görmeyen iki kâhinin bakımı (cari kâhini, muhasebe kâhini) AYRI ajanlarda; senin kodun ana dala ancak onlarla karşılaştırıldıktan sonra girer — kâhin dosyalarını OKUMAZ, YAZMAZSIN.

{hazirlik(taban=TABAN, taban_ne="çalışma dalı + D3 (devir saf hesabı tur 1–5) birleşimi; ana oturum ajanı başlatırken koyar")}
3. Sonra oku: `docs/devir/2.5.1-DEVAM/d3t4-rapor.md` §9 (S-T4-1'in gerçek veride bulunuşu, tohum 11) ve `d3t5-rapor.md` (S-T4-1 sabitleme testi, gerçek veri karşılaştırmasındaki 'BEKLENEN FARK (S-T4-1)' sayacı); `docs/erp/C5B-TYK-TASARIM.md` (tek borç sırasının kilit sınırı bölümü); `docs/erp/C3-DONDURMA-TASARIM.md` (Kural Farkı Düzeltme Fişi, Kilidi Aç). KOD: `server/lib/obligation-queue.mjs`, `server/lib/obligation-input.mjs`, Dönem Kilidi'nin kilit / kilit açma yolu (`server/routes/ledger.mjs` — YALNIZ kilit ucu), `server/lib/ledger-snapshots.mjs` (kural farkı iletileri), Dönem Kilidi ekranının istemci dosyası.

## DOSYA SINIRI (kullanıcı kararıyla kurulan TEK BORÇ SIRASI ZİNCİRİ — AYNEN aşağıda)
YAZABİLİRSİN: tek borç sırası ve girdisi (yalnız kilit sınırının ölçümü), Dönem Kilidi'nin kilit ucu, kural farkı iletileri, Dönem Kilidi ekranı (yalnız ret nedeni / düğme), devir ileti kataloğundaki YALNIZ alt defter kural farkı iletisinin metni (BM-T5-3), testler, kanıt, rapor. YAZAMAZSIN: devir saf hesabının hesap kodu (plan zaten A'yı veriyor — DEĞİŞMEZ), göçler, defter türetmesi (≤K bastırma / açılış — D4a'nın işi), şüpheli defter türetmesi, Ödeme Hatırlatma, WhatsApp. Gerekirse DUR → raporda 'BAŞ MİMAR KARARI GEREKİYOR'.
{ZINCIR}

## Kararlar (AYNEN)
2.5.0 KARARI (2.5.0 iş listesi D, AYNEN): {K28}
2.5.1 KULLANICI KARARI (AYNEN): {K_1816}
S-T4-1 SORUSUNUN METNİ (AYNEN; içindeki program sayıları ÖLÇÜMDÜR): {Q_ST41}
S-KD2-3 SORUSUNUN METNİ (AYNEN): {Q_SKD23}
BAŞ MİMAR OKUMASI (kâhin girdisine verilen — senin kodun AYNI okumayı uygular; kullanıcıya gösterildi): S-T4-1 = A yeni bir kural değil, madde 28 = A'nın ÖLÇÜM ANINI netleştirir — "kilitli dönemde bağsız kapanmış kısım" kilitli dönemin GERÇEK durumunda (kilit tarihine kadarki kayıtlar, bağsız ödemeler kendi tarihlerindeki sırayla; kilitten sonraki bağ HENÜZ YOKKEN) ölçülür; sonradan kurulan bağ yalnız o anda AÇIK kalan kısmı kapatabilir, fazlası bağsız ödeme gibi vadesi en önce gelen açık borca gider ('program bunu kayıtta yazar' — madde 28). Örnekte: kilit anında faturanın açık kısmı 0 → 06.01.2027'deki 128,00 bağlı tahsilat bağsız gibi dağılır → açık kalemler 280,00 (vade 22.12.2026) + 1.245,40 (19.01.2027), 19.01'e kadar gecikmiş 280,00; bakiye 1.525,40. Kilit kaldırılınca kural o dönem için kalkar (açık dönemde bağ önceliği). Mahsup Et bağı da 'bağ'dır (kararın metni: 'faturaya bağlı tahsilat / mahsup').
D3 TUR 5 BAŞ MİMAR KARARLARI (AYNEN): {BMT53} {OLCUM}
DEVİR NEDEN DURDU İLETİ DÜZENİ (S-KD2-3 iletisi bu dört alanla yazılır — karar AYNEN): {NEDEN}

## İşler
0. NASIL BOZULUR (rapor taslağının başına, koddan ÖNCE, commit): kilitten önce / sonra bağ; iade + bağsız / yalnız bağsız / kısmi; kilit aç → yeniden kilitle; kilidi geriye çekme / ileri alma; aynı gün birden çok bağ; mahsup ile bağ; ödenecek (tedarikçi) yönü; iki şirket; yedek geri yükleme; eski sürüm (v2.5.0) verisi; Silinenler'den geri yükleme; bağın silinmesi / değiştirilmesi.
1. ÖNCE ÖLÇ (kod değiştirmeden; kanıt): bugünkü tek borç sırasının S-T4-1 örneğinde ve şu sınıflarda ne verdiği — (a) kilitli dönemde iade + bağsız tahsilatla kapanmış fatura + kilitten sonra bağlı tahsilat (tohum 11 eşdeğeri); (b) yalnız bağsız tahsilatla kapanmış (D3 tur 5 ölçümü: program bunda kaydırmıyor); (c) kısmen kapanmış (kilit anında açık kısım > 0 ve bağ bundan büyük / küçük); (d) kilitten sonra Mahsup Et; (e) ödenecek yönü (alış faturası + bağsız ödeme). Hangi sınıfta A'dan ayrıştığı ve KÖK NEDENİ (iade bağının ölçüm geçişindeki yeri) rapora.
2. S-T4-1 DÜZELTMESİ: tek borç sırası kilitli dönemin bağsız kapanışını kilit anındaki duruma göre ölçer; kilitten sonraki bağ yalnız o andaki açık kısmı kapatır, fazlası bağsız gibi dağılır ve kayıtta yazılır (gösterilen yer ve metin rapora; YAZIM DÜZENİ). Kilidin olmadığı dönemde davranış DEĞİŞMEZ (eşdeğerlik testi). Kararın söylemediği bir sınıfta (ör. ödenecek yönünde kilitten sonra iade) A'dan başka bir sonuç gerekiyorsa KODLAMA — 'KULLANICIYA SORULMALI' (ders 43).
3. S-KD2-3: etkin Kural Farkı Düzeltme Fişi varken Kilidi Aç sunucuda REDDEDİLİR (yanıt kodu + gövde; kilit DEĞİŞMEZ — veri tabanından okunur, ders 3); ileti dört alanla (ne oldu: hangi fiş, numara, tutar, dönem / neden: fiş kilitli dönemin farkını düzeltiyor, kilit açılırsa fark ikinci kez düzeltilebilir / ne yapmalı: 'önce düzeltme fişini Ters Kaydet, sonra Kilidi Aç' / nereye: ekran adı); ekranda düğme pasifse nedeni görünür yazı (kalıcı ürün kararı). Fiş ters kaydedildikten sonra Kilidi Aç GEÇER. Kararın örneği kalıcı testte: fark 3.000 → ikinci fiş YAZILAMAZ, 602 / 519 iki kez sayılmaz.
4. BM-T5-3: alt defter kural farkı iletisinin adımları ('Kilidi Aç → Yeniden Kilitle') etkin düzeltme fişi varken 'önce düzeltme fişini Ters Kaydet → Kilidi Aç → Yeniden Kilitle' olur (programın ürettiği iletinin kendisi; devir ileti kataloğunda da aynı metin).
5. ESKİ SÜRÜMLE SINIF SINIF (ders 53 (b)): v2.5.0'ın gerçek koduyla (ayrı `git worktree add --detach` kopyası; v2.5.0'ın API'siyle üretilmiş veri) iş 1'in (a)–(e) sınıfları × kilitli / kilitsiz × boş / kısmi / tam — kalıcı test; her fark 'beklenen farklar' dosyasında karar numarasıyla (S-T4-1, S-KD2-3); yazılı olmayan fark BAŞARISIZ.
6. DEVİR KARŞILAŞTIRMASI: D3'ün gerçek veri karşılaştırması (3 tohum × 2 TZ) — 'BEKLENEN FARK (S-T4-1)' sayacı 0'a iner (KABUL ÖLÇÜTÜ; sayaç / sınıf düzeni D3 tur 5'te); açıklanmamış fark 0; D3'ün S-T4-1 sabitleme testi devirsiz programda da aynı sayıyı verir (devirli = devirsiz).

## Kabul
A yeni testler eski kodda (taban) beklenen nedenle kırmızı (NEDENİ yazılır — ders 38), yenide yeşil iki TZ; B mutasyon (en az: kilit anı ölçümü kalksın, fazla bağ faturada kalsın, iade bağı ölçümden düşsün, kilit kalkınca kural sürsün, Kilidi Aç reddi kalksın, ret iletisi 'Ters Kaydet' adımı düşsün, ödenecek yönü unutulsun) hepsi yakalanır iki TZ; C v2.5.0 sınıf karşılaştırması yazılı farklar dışında 0; D devir gerçek veri S-T4-1 sayacı 0, açıklanmamış fark 0; E komşular — tek borç sırasını kullanan HER yol (`git grep` ile çağıranlar: cari kartı / listesi, Açık Faturalar, taksit, şüpheli alacak, Değersiz sınırı, mobil özet, WhatsApp seçimi, devir planı, raporlar) iki TZ yeşil; F `npm run test:kahin-cari` ve `npm run test:kahin-defter` iki TZ — bugünkü kâhinle farkın YALNIZ S-T4-1 / S-KD2-3 sınıflarında olduğu (fark listesi rapora; kâhinin yeni bakımıyla karşılaştırmayı ana oturum yapar); G HIZ: tek borç sırası değişti (ders 47, 53 (a)) — öğe başına ağır okuma EKLENMEZ; kilit geçmişinin okunuşu toplu; ölçemiyorsan (yük) 'ÖLÇÜLMEDİ' yaz, ana oturum özel kilitle ölçer (cari kartı, Cari Listesi, Açık Faturalar, devir ön izlemesi — temiz 100 bin).

{KURALLAR_KULLANICI}
KULLANICI KURALI (27.11, AYNEN: "bir süre ekran başında olmayacağım. sorularına baş mimar önerilerini uygula"): bu senin kodlama izni DEĞİLDİR — para / kapama kuralı ayrışmasında yine KODLAMA, 'KULLANICIYA SORULMALI' yaz (öneriyle); ana oturum karar verir.

{kurallar('kilit', taban=TABAN)}

{rapor()}
"""
open('/home/user/ofis---y-netimi/docs/devir/2.5.1-DEVAM/kilit-istem.txt', 'w', encoding='utf-8').write(KILIT)
print(len(KILIT))
