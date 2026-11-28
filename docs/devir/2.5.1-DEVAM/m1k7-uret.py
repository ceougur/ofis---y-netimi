#!/usr/bin/env python3
# KDV Özeti küçük tur 7 görev metni (tur 6'nın 'BAŞ MİMAR KARARI GEREKİYOR'u — devreden farkı kolunun onarım cümlesi; YALNIZ not metni): m1k7-istem.txt. Kararlar iş listesinden AYNEN. Ana oturum, 28.11.2026.
src = open('/home/user/ofis---y-netimi/docs/devir/2.5.1-DEVAM/istem-uret.py').read().split('# ---------------------------------------------------------------- P-D')[0]
exec(src)
IS = open('/home/user/ofis---y-netimi/docs/2.5.1-IS-LISTESI.md', encoding='utf-8').read()

def satir(anahtar, metin=IS):
    i = metin.find(anahtar); assert i >= 0, anahtar
    assert metin.find(anahtar, i + 1) < 0, 'tekil değil: ' + anahtar
    b = metin.rfind('\n', 0, i) + 1; e = metin.find('\n', i)
    return metin[b:e].strip()

BM6 = satir('(KDV ÖZETİ KÜÇÜK TUR 6 raporu')
BM5 = satir('(DAR KONTROL KDV ÖZETİ KÜÇÜK TUR 5 raporu')
Q = satir('S-DKM1K-1 (KDV Özeti tek dar kontrolü ORTA-1')
YETKI = satir('KULLANICI KARARI 27.11 20:26 UTC (AYNEN: "bir süre ekran başında olmayacağım')
K_DKM = satir('KULLANICI KARARI 27.11 14:18 UTC').split(' UYGULAMA (baş mimar')[0]
TABAN = 't251-m1k6'
SP_DK = SP + '/dk-m1k5'
RK = SP + '/m1k6yk'

M1K7 = f"""Sen DestekOfis projesinde 2.5.1'in KDV ÖZETİ KÜÇÜK TUR 7 KOD ajanısın (eforun high). KDV Özeti küçük tur 1–5 çalışma dalında; tur 6 başka ajanla bitti (dal ucu etiketi t251-m1k6 = e99b6c95; ana dala HENÜZ GİRMEDİ — senin tabanın) ve uyuşmazlık notunun EKSİ yönünü düzeltti. Tur 6 aynı sorunun DEVREDEN FARKI kolunda da olduğunu buldu (ana oturum iki TZ yeniden üretti). Temiz bağlamla YALNIZ bunu düzeltirsin (ders 46). Mahsup fişi, ön izleme, defter ve KDV Özeti'nin SAYILARI DEĞİŞMEZ — yalnız notun onarım cümlesi.

{hazirlik(taban=TABAN, taban_ne="KDV Özeti küçük tur 6'nın dal ucu e99b6c95")}
3. Sonra oku: tur 6'nın raporu `docs/devir/2.5.1-DEVAM/m1k6-rapor.md` (kendi ağacında; YALNIZ 'BAŞ MİMAR KARARI GEREKİYOR', test ve betik bölümleri), `server/routes/tax.mjs` (uyuşmazlık kaydı — onarım ayı `restartMonth` / `restartLabel`, `staleBefore`), `server/routes/report-center.mjs` (notlar — `mismatchRepair`), testler `test/kdv-ozeti-uyusmazlik-yonu-251.test.mjs`, devreden kolunun testleri (karma / yalnız391 / s4 — `git grep` ile bul), ekran senaryosu `test/e2e/senaryo-kdv-mahsup-sonrasi-251.mjs` (D / E adımları). Betikler (izinli — senin girdin): tur 6'nın `docs/kanit/2026-11-28/m1k6-s5-devreden-onarim.mjs` ve `m1k6-s6-onarim.mjs` (kendi ağacında), ana oturumun yeniden üretimi `{RK}/ham/s5-devreden-onarim-ikiTZ.txt`, dar kontrolün `{SP_DK}/` betikleri.

## Bulgu ve kararlar (AYNEN)
TUR 6'NIN RAPORU VE BAŞ MİMAR KARARI (karar (1) senin işin): {BM6}
TUR 5 DAR KONTROLÜNÜN BULGUSU VE BAŞ MİMAR KARARI (tur 6'nın kaynağı — eksi yön): {BM5}
TUR 5'İN KARARI (AYNEN; sayılar bundan): {Q}
KULLANICI YETKİSİ (AYNEN): {YETKI}
ÖNCEKİ KARARLAR (değişmez): {K_DKM}

## İşler
0. NASIL BOZULUR (koddan ÖNCE, commit): devreden farkı kolu × önceki ay devreden yönde / ödenecek yönde güncel değil × önceki güncel olmayan fiş yok / bir / iki × yıl dönümü × fiş değişiklikten önce / sonra kesilmiş; eksi yön (tur 6) ve öbür yön metinleri bozulmaz; iki TZ; ekran = PDF = Excel.
1. Kod: devreden farkı kolunda da onarım ayı kuralı — önceki aylarda mahsup fişi güncel olmayan ay varsa cümle 'mahsup fişi güncel olmayan ilk aydan (ay adıyla, yıl dönümünde yılıyla) başlayarak mahsupları geri alın, ayları sırayla yeniden mahsup edin' der (tur 6'nın eksi yön düzeni); yoksa bugünkü cümle AYNEN. Neden cümlesi ('… devredenle kesilmiş, sırayla mahsupta … olmalıydı') değişmez.
2. KALICI TEST: tur 6'nın s5 vakası AYNEN (Ocak–Nisan; D0 Mart notu; notun YENİ cümlesinin söylediği adımlar uygulanınca not kalkar ve Ocak–Mayıs 2.400 = 391 − 191; fişler 02:…/800, 03:800/1000/0, 04:0/900/0); öncesiz durumda cümle AYNEN; iki 'güncel değil' ayda ilki; yıl dönümü. Karma / yalnız391 / s4 testlerinin ve e2e D / E adımlarının beklentisi yeni cümleyle (ekran senaryosu onarımı ekrandan yürür). Tabanda (t251-m1k6) beklenen nedenle kırmızı (NEDEN — ders 38), yenide yeşil iki TZ.
3. Mutant: tur 6'nın 6 mutantı AYNEN + bu turun en az ikisi (devreden kolu yine 'bu aydan' desin; onarım ayı son güncel olmayan ay olsun) — her biri kırmızı iki TZ.
4. Komşular: tur 6'nın komşu listesi (37 birim dosya + rastgele test) iki TZ; KDV Özeti'ne dokunan ekran senaryolarının hepsi (senaryo-kdv-mahsup-sonrasi-251, senaryo-kdv-zincir-251, senaryo-kdv-devreden-251, senaryo-kdv-donemi-250, senaryo-c7b-kabul-250, senaryo-defter-243) iki TZ; SAYILAR tabanla BİREBİR (dar kontrolün s2 üreteci — fark 0, iki TZ; not farkı yalnız devreden kolunun onarım cümlesinde); `npm run test:kahin-defter` iki TZ (dokunmadan).

## Kabul
A yeni / değişen testler tabanda beklenen nedenle kırmızı, yenide yeşil iki TZ; B sayılar birebir; C notun söylediği onarım uygulanınca not kalkar (her iki kolda); D mutantlar yakalanır; E komşular + ekran senaryoları yeşil; F hız: yeni sorgu yok (ders 47) — ölçemiyorsan 'ÖLÇÜLMEDİ'.

{KURALLAR_KULLANICI}
NOT: kullanıcının yetkisi SENİN kodlama iznin DEĞİLDİR — kodlama sırasında yeni bir SAYI ayrışması çıkarsa KODLAMA, 'KULLANICIYA SORULMALI' (öneriyle).

{kurallar('m1k7', taban=TABAN)}

{rapor()}
"""
open('/home/user/ofis---y-netimi/docs/devir/2.5.1-DEVAM/m1k7-istem.txt', 'w', encoding='utf-8').write(M1K7)
print(len(M1K7))
