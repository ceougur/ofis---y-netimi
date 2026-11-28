#!/usr/bin/env python3
# KDV Özeti küçük tur 6 görev metni (tur 5 dar kontrolünün ORTA-1'i — YALNIZ not metni): m1k6-istem.txt. Kararlar iş listesinden AYNEN. Ana oturum, 28.11.2026.
src = open('/home/user/ofis---y-netimi/docs/devir/2.5.1-DEVAM/istem-uret.py').read().split('# ---------------------------------------------------------------- P-D')[0]
exec(src)
IS = open('/home/user/ofis---y-netimi/docs/2.5.1-IS-LISTESI.md', encoding='utf-8').read()

def satir(anahtar, metin=IS):
    i = metin.find(anahtar); assert i >= 0, anahtar
    assert metin.find(anahtar, i + 1) < 0, 'tekil değil: ' + anahtar
    b = metin.rfind('\n', 0, i) + 1; e = metin.find('\n', i)
    return metin[b:e].strip()

BM = satir('(DAR KONTROL KDV ÖZETİ KÜÇÜK TUR 5 raporu')
Q = satir('S-DKM1K-1 (KDV Özeti tek dar kontrolü ORTA-1')
YETKI = satir('KULLANICI KARARI 27.11 20:26 UTC (AYNEN: "bir süre ekran başında olmayacağım')
K_DKM = satir('KULLANICI KARARI 27.11 14:18 UTC').split(' UYGULAMA (baş mimar')[0]
Q_M13 = satir('S-M1-3 (27.11 08:35 UTC; M1 tur 2 raporu')
TABAN = 't251-m1k6-taban'
SP_DK = SP + '/dk-m1k5'

M1K6 = f"""Sen DestekOfis projesinde 2.5.1'in KDV ÖZETİ KÜÇÜK TUR 6 KOD ajanısın (eforun high). KDV Özeti küçük tur 1–5 ana dala (çalışma dalı) girdi; tur 5'in bağımsız dar kontrolü bir ORTA bulgu verdi (ana oturum yeniden üretti) — YALNIZ METİN: sayılar doğru. Temiz bağlamla YALNIZ bu bulguyu düzeltirsin (ders 46). Mahsup fişi, ön izleme, defter ve KDV Özeti'nin SAYILARI DEĞİŞMEZ — yalnız raporun notları.

{hazirlik(taban=TABAN, taban_ne="çalışma dalı — KDV Özeti küçük tur 1–5 dahil")}
3. Sonra oku: `server/routes/tax.mjs` (KDV Özeti zinciri — `vatView`, uyuşmazlık kaydı `mismatches`), `server/routes/report-center.mjs` (KDV Özeti notları — 'Mahsuptan Sonra Değişen Ay', 'Zincirle Uyuşmayan Mahsup Fişi', aralık süzgeci), KDV Özeti testleri (`test/kdv-ozeti-*-251.test.mjs`), ekran senaryosu `test/e2e/senaryo-kdv-mahsup-sonrasi-251.mjs`. Dar kontrolün betikleri ve ham çıktıları (izinli — senin girdin): `{SP_DK}/` (s1-ornek.mjs — `ROOT=<kod> node s1-ornek.mjs`; s3-nisan-tek.mjs; s2-karisik.mjs + s2-karsilastir.py; çıktılar s1-*.txt, s3-yeni.txt).

## Bulgu ve kararlar (AYNEN)
DAR KONTROLÜN BULGUSU VE BAŞ MİMAR KARARI: {BM}
TUR 5'İN KARARI (AYNEN; sayılar bundan): {Q}
KULLANICI YETKİSİ (AYNEN): {YETKI}
ÖNCEKİ KARARLAR (değişmez): {K_DKM}
{Q_M13}

## İşler
0. NASIL BOZULUR (koddan ÖNCE, commit): uyuşmazlığın iki yönü (zincir emilimi fişinkinden eksi / artı) × fiş değişiklikten önce / sonra kesilmiş × onarım yolu (yalnız bu ay / ilk 'güncel değil' aydan) × aralık: tam / tek ay / 'güncel değil' ayı dışarıda bırakan kısmi aralık / yıl dönümü; iki TZ; ekran = PDF = Excel (ders 11).
1. Kararın (1)(a): uyuşmazlık kaydına yön bilgisi; zincir emilimi fişinkinden EKSİYSE neden cümlesi 'fiş İndirilecek KDV'deki azalmayı düşmemiş' anlamında, onarım 'mahsup fişi güncel olmayan ilk aydan (ay adıyla) başlayarak mahsupları geri alın, ayları sırayla yeniden mahsup edin'; öbür yönün metni AYNEN kalır. Notun önerdiği onarım GERÇEKTEN sonuç vermeli: kalıcı testte notun söylediği adımlar uygulanınca not kalkar ve rapor = fişler = 391 − 191 (A3 / B2 düzeni).
2. Kararın (1)(b): tek ay / kısmi aralıkta aralığın sayısını aralık DIŞINDAKİ 'güncel değil' fiş etkiliyorsa kısa not (ör. 'Önceki aylarda güncel olmayan mahsup fişi var (Şubat 2026); bu ayın sayıları mahsup ön izlemesinden ayrılır'); etkilemiyorsa not YOK (gereksiz not da hata). Yazım düzeni (not başlıkları her sözcük büyük; cümle cümle düzeninde).
3. Kararın (1)(c): ekran senaryosunun F adımı notu TAM cümlesiyle sabitler (yanlış neden cümlesinde kırmızı).
4. Kararın (1)(d) (prensip §4 — yalnız teste dokunan): rastgele testin yıl dönümü seti ayrı tohum formülüyle yeni veri şekilleri üretir; toplam süre artmaz.
5. Kalıcı testler tabanda (t251-m1k6-taban) beklenen nedenle kırmızı (NEDEN — ders 38), yenide yeşil iki TZ; mutant: yön ayrımı kalksın (eski metin); onarım ay adı yanlış ay olsun; tek ay notu her zaman çıksın / hiç çıkmasın — her biri kırmızı.
6. Komşular: KDV testleri + `git grep` (değişen işlevlerin çağıranları); KDV Özeti'ne dokunan ekran senaryolarının hepsi (senaryo-kdv-mahsup-sonrasi-251, senaryo-kdv-zincir-251, senaryo-kdv-devreden-251, senaryo-kdv-donemi-250, senaryo-c7b-kabul-250, senaryo-defter-243) iki TZ; SAYILAR tabanla BİREBİR (dar kontrolün s2-karisik üretecinde rapor sayıları taban = yeni, iki TZ — fark 0 olmalı); `npm run test:kahin-defter` iki TZ (dokunmadan).

## Kabul
A yeni / değişen testler tabanda beklenen nedenle kırmızı, yenide yeşil iki TZ; B sayılar birebir (rastgele + kararların örnekleri); C notun önerdiği onarım uygulanınca not kalkar; D mutantlar yakalanır; E komşular + ekran senaryoları yeşil; F hız: yeni sorgu yok (ders 47) — ölçemiyorsan 'ÖLÇÜLMEDİ'.

{KURALLAR_KULLANICI}
NOT: kullanıcının yetkisi SENİN kodlama iznin DEĞİLDİR — kodlama sırasında yeni bir SAYI ayrışması çıkarsa KODLAMA, 'KULLANICIYA SORULMALI' (öneriyle).

{kurallar('m1k6', taban=TABAN)}

{rapor()}
"""
open('/home/user/ofis---y-netimi/docs/devir/2.5.1-DEVAM/m1k6-istem.txt', 'w', encoding='utf-8').write(M1K6)
print(len(M1K6))
