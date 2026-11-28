#!/usr/bin/env python3
# Değersiz sınırı TUR 3 (S-M2T2-1 / 2 = A) görev metni: m2t3-istem.txt. Ana oturum, 27.11.2026.
src = open('/home/user/ofis---y-netimi/docs/devir/2.5.1-DEVAM/istem-uret.py').read().split('# ---------------------------------------------------------------- P-D')[0]
exec(src)
IS = open('/home/user/ofis---y-netimi/docs/2.5.1-IS-LISTESI.md', encoding='utf-8').read()

def satir(anahtar, metin=IS):
    i = metin.find(anahtar); assert i >= 0, anahtar
    assert metin.find(anahtar, i + 1) < 0, 'tekil değil: ' + anahtar
    b = metin.rfind('\n', 0, i) + 1; e = metin.find('\n', i)
    return metin[b:e].strip()

BM = satir('(DEĞERSİZ SINIRI TUR 2 raporu')
BM1 = satir('(DAR KONTROL M2 raporu')
Q4 = satir('S-M2T2-1 (Değersiz sınırı tur 2 raporu')
Q5 = satir('S-M2T2-2 (aynı kaynak')
Q2 = satir('S-DKM2-2 (dar kontrol M2 ORTA-2')
Q3 = satir('S-DKM2-3 (dar kontrol M2 ORTA-3')
K_M21 = satir('KULLANICI KARARI 27.11 07:32 UTC').split(' UYGULAMA (baş mimar')[0]
ZINCIR = satir('TEK BORÇ SIRASI ZİNCİRİ (BAŞ MİMAR KARARI')
TABAN = 't251-m2t2'

M2T2 = f"""Sen DestekOfis projesinde 2.5.1'in DEĞERSİZ ALACAK SINIRI TUR 3 kod ajanısın (PARA ÇEKİRDEĞİ: şüpheli alacak; eforun high). Tur 1 ana dalda (çalışma dalı); tur 2 (hız + S-DKM2-2 = A + S-DKM2-3 iletisi) başka ajanla bitti (dal ucu etiketi t251-m2t2 = bf7e7d21; ana dala GİRMEDİ; raporu kendi ağacında `docs/devir/2.5.1-DEVAM/m2t2-rapor.md`). Temiz bağlamla YALNIZ tur 2'nin açtığı iki sorunun öneriyle uygulanan yanıtlarını kodlarsın (ders 46) — küçük tur.

{hazirlik(taban=TABAN, taban_ne="Değersiz sınırı tur 2'nin dal ucu bf7e7d21")}
3. Sonra oku: `docs/devir/2.5.1-DEVAM/m2-kararlar.md` (kararlar AYNEN), şüpheli alacak modülü (`server/lib/bank/doubtful.mjs` — sınır hesabı, aday günler, değişmez (i) / (ii), silme / geri yükleme çakışma denetimi), rotası, cari istemcisindeki Değersiz formu ve kartın şüpheli listesini açılışta okuması, kapı ret iletileri (`server/lib/integrity.mjs` — S155 için var olan anlaşılır ileti deseni), fatura iptali ve iade yolları (YALNIZ ilgili yerler). Dar kontrolün betikleri ve ham çıktıları (izinli — senin girdin): `{SP}/dk-m2/betik/` (p1 gün taraması — eşdeğerlik için; p4 yollar; p5b v2.5.0 verisi; p6 liste hızı; p8 iade / iptal) ve `{SP}/dk-m2/cikti/`; ana oturumun yeniden üretimi `{SP}/dkm2-rk/p6-eski-60.txt`, `p6-yeni-60.txt`.

## DOSYA SINIRI
YAZABİLİRSİN: şüpheli alacak modülü ve rotası, cari istemcisinin şüpheli / Değersiz kısmı, kapı ret iletileri (yalnız Değersiz sınırı nedenleri), fatura iptali ve iade yollarında YALNIZ bu karar için çağrılacak denetim, testler, ekran senaryosu, kanıt, rapor. YAZAMAZSIN: tek borç sırası ve girdisi, defter rotası, şüpheli DEFTER türetmesi (TEK BORÇ SIRASI ZİNCİRİ — aşağıda AYNEN; kilit paketi şu an bu dosyalarda çalışıyor), göçler. Gerekirse DUR → 'BAŞ MİMAR KARARI GEREKİYOR'.
{ZINCIR}

## Kararlar (AYNEN)
TUR 2'NİN RAPORU VE BAŞ MİMAR KARARI: {BM}
ÖNCEKİ DAR KONTROL VE KARARLAR (bağlam): {BM1}
ÖNCEKİ KULLANICI KARARI (değişmez): {K_M21}
S-DKM2-2 (AYNEN): {Q2}
YENİ SORU 1 VE YANITI (AYNEN): {Q4}
YENİ SORU 2 VE YANITI (AYNEN): {Q5}

## İşler
0. NASIL BOZULUR (koddan ÖNCE, commit): Değersiz'den sonra iptal / iade / tutar düşürme × cari Değersiz olmadan da eksi / yalnız Değersiz yüzünden eksi / eksi değil; birden çok Değersiz satırı; kilitli dönem; iki saat dilimi.
1. S-M2T2-1 = A: Değersiz Alacak yazılmış caride iptal ya da iade, sonuç bakiye eksi kalacaksa (Değersiz olmadan da eksi olsa bile) reddedilir; ileti tur 2'nin dört alanlı düzeniyle (sayıları bu duruma göre). Tur 2'nin bu durumu B olarak belgeleyen testi A'ya döner (eski → yeni sayılar rapora). Örnek AYNEN: 05.10 avans 3.000, fatura 2.900 iptal → RET, bakiye −2.576,45 kalır.
2. S-M2T2-2 = A: Değersiz'den sonra fatura TUTARININ Düzenle ile düşürülmesi iade gibi reddedilir (S241 = A çizgisi); örnek AYNEN: 2.900 → 100 RET, bakiye 423,55 kalır. Aynı kök nedenin başka yolu (bağlı çekin karşılıksız çıkması bakiyeyi YÜKSELTİYOR — farklı kök, DOKUNMA) — yalnız rapora.
3. Kalıcı testler + ekran senaryosuna iki adım (senaryo-degersiz-iptal-m2t2-251); eski kodda (taban t251-m2t2) beklenen nedenle kırmızı, yenide yeşil iki TZ. Mutasyon: tur 2'nin 12'si AYNEN + en az iki (eksi kontrolü yalnız Değersiz kaynaklıya dönsün; tutar düşürme denetimi kalksın).
4. Komşular: tur 2'nin 80 dosyalık listesi + fatura Düzenle yolu (`git grep`) iki TZ; iki ekran senaryosu; `npm run test:kahin-cari` (kodunu okumadan; beklenen fark listesi rapora).

## Kabul
A yeni / değişen testler tabanda beklenen nedenle kırmızı, yenide yeşil iki TZ; B mutantlar yakalanır; C komşular yeşil; D tur 2'nin hız eşdeğerliği AYNEN (hız yoluna dokunulmaz).

{KURALLAR_KULLANICI}
KULLANICI KURALI (27.11, AYNEN: "bir süre ekran başında olmayacağım. sorularına baş mimar önerilerini uygula"): senin kodlama iznin DEĞİLDİR — yeni para / kapama ayrışmasında KODLAMA, 'KULLANICIYA SORULMALI' (öneriyle).

{kurallar('m2t3', taban=TABAN)}

{rapor()}
"""
open('/home/user/ofis---y-netimi/docs/devir/2.5.1-DEVAM/m2t3-istem.txt', 'w', encoding='utf-8').write(M2T2)
print(len(M2T2))
