#!/usr/bin/env python3
# KDV Özeti küçük tur 5 görev metni (tek dar kontrolün ORTA-1'i): m1k5-istem.txt. Kararlar iş listesinden AYNEN. Ana oturum, 28.11.2026.
src = open('/home/user/ofis---y-netimi/docs/devir/2.5.1-DEVAM/istem-uret.py').read().split('# ---------------------------------------------------------------- P-D')[0]
exec(src)
IS = open('/home/user/ofis---y-netimi/docs/2.5.1-IS-LISTESI.md', encoding='utf-8').read()

def satir(anahtar, metin=IS):
    i = metin.find(anahtar); assert i >= 0, anahtar
    assert metin.find(anahtar, i + 1) < 0, 'tekil değil: ' + anahtar
    b = metin.rfind('\n', 0, i) + 1; e = metin.find('\n', i)
    return metin[b:e].strip()

Q = satir('S-DKM1K-1 (KDV Özeti tek dar kontrolü ORTA-1')
BM = satir('(DAR KONTROL KDV ÖZETİ KÜÇÜK TUR 1–4 raporu')
YETKI = satir('KULLANICI KARARI 27.11 20:26 UTC (AYNEN: "bir süre ekran başında olmayacağım')
K_DKM = satir('KULLANICI KARARI 27.11 14:18 UTC').split(' UYGULAMA (baş mimar')[0]
K_M1K = satir('KULLANICI KARARI 27.11 16:16 UTC').split(' UYGULAMA (baş mimar')[0]
K_M1K2 = satir('KULLANICI KARARI 27.11 19:44 UTC').split(' UYGULAMA (baş mimar')[0]
Q3 = satir('S-M1K3-1 (KDV Özeti küçük tur 3 raporu §7')
TABAN = 't251-m1k4'
SP_DK = SP + '/dk-m1k'

M1K5 = f"""Sen DestekOfis projesinde 2.5.1'in KDV ÖZETİ KÜÇÜK TUR 5 KOD ajanısın (eforun high). KDV Özeti küçük tur 1–4 başka ajanlarla bitti (dal ucu etiketi t251-m1k4 = 4850ae2a; ana dala GİRMEDİ); bağımsız tek dar kontrolü bir ORTA bulgu verdi. Temiz bağlamla YALNIZ bu bulguyu düzeltirsin (ders 46). Mahsup fişi, ön izleme ve defter DEĞİŞMEZ — yalnız KDV Özeti raporunun gösterimi.

{hazirlik(taban=TABAN, taban_ne="KDV Özeti küçük tur 4'ün dal ucu 4850ae2a")}
3. Sonra oku: `server/routes/tax.mjs` (KDV Özeti zincir döngüsü — `vatView`, `settle`, S4 birikimi), tur 4'ün raporu `docs/devir/2.5.1-DEVAM/m1k4-rapor.md` (kendi ağacında; YALNIZ test / betik bölümleri), KDV Özeti testleri (`test/kdv-ozeti-*-251.test.mjs`). Dar kontrolün betikleri ve ham çıktıları (izinli — senin girdin): `{SP_DK}/betik/` (s1-artis-sonra-azalma.mjs, s2-rastgele.mjs, s2b-yil-donumu.mjs, s3-varyant-onarim.mjs, s4-karar-ornekleri.mjs, ortak.mjs), `{SP_DK}/cikti/`, deneme yaması `{SP_DK}/deneme-yamasi.diff` (bir ÖNERİ — doğruluğunu kanıtla).

## Bulgu ve kararlar (AYNEN)
DAR KONTROLÜN BULGUSU VE BAŞ MİMAR KARARI: {BM}
SORU VE YANITI (AYNEN): {Q}
KULLANICI YETKİSİ (AYNEN): {YETKI}
ÖNCEKİ KARARLAR (değişmez): {K_DKM}
{K_M1K}
{K_M1K2}
{Q3}

## İşler
0. NASIL BOZULUR (koddan ÖNCE, commit): 'güncel değil' ay × İndirilecek artışı / azalışı / satış değişimi × ödenecek / devreden yön × arkasından fişi zincirde kalan azalan ay / mahsupsuz ay / ikinci 'güncel değil' ay; yıl dönümü; onarım (geri al + sırayla yeniden mahsup) sonrası rapor = fişler; iki TZ.
1. Kod: S-DKM1K-1 = A — 'güncel değil' ay S4 birikimine fişin saklı İndirilecek KDV'siyle değil, mahsupsuz ay gibi bugünkü değeriyle girer (dar kontrolün en küçük düzeltme önerisi; başka bir yol seçersen gerekçesiyle). Kararların ÖTEKİ örnekleri (S-DKM1-1, S-M1K-1, S-M1K2-1, S-M1K3-1 (a) / (b)) AYNEN kalır. Kaynak yorumundaki 'İ artışı S4 taşımasına girmez' savı düzeltilir.
2. KALICI TESTLER: (a) S1 örneği AYNEN (Ocak–Nisan Ödenecek 1.600 = 391 3.500 − 191 1.900; Nisan 700; Şubat 'güncel değil' notu durur); (b) rastgele sıra değişmez kuralı — 'Ödenecek − Sonraki + Önceki = 391 − 191' her aralıkta, en az 300 tohum (s2-rastgele'nin düzeni; tohumlu, tekrarlanabilir — ders 13: sahte saat) + yıl dönümü en az 150 tohum (s2b); tabanda (t251-m1k4) beklenen nedenle kırmızı (S1 1.400; tohum 230 ve 11 sapma — NEDEN yazılır, ders 38), yenide yeşil iki TZ.
3. YAN ETKİ ÖLÇÜMÜ: Nisan raporu (700) Nisan ön izlemesinden (500) ayrılıyor — Nisan bu ön izlemeyle mahsup edilirse Nisan fişi 'Zincirle Uyuşmayan Mahsup Fişi' sayılıyor mu, sayılıyorsa not metni ekranda doğru mu, aralık toplamı yine 391 − 191 mi (ölç, rapora; kararın söylemediği yeni bir sayı ayrışması çıkarsa KODLAMA — 'KULLANICIYA SORULMALI').
4. Mutant: tur 1–4'ün mutantları AYNEN + bu turun en az iki mutantı ('güncel değil' ay yine fişin değeriyle girsin; azalma birikimi min(0, …) yerine düz toplansın) — her biri kırmızı iki TZ.
5. Komşular: KDV testleri + tur 4'ün komşu listesi + `git grep` (tax.mjs'in değişen işlevinin çağıranları); KDV Özeti'ne dokunan ekran senaryolarının HEPSİ (senaryo-kdv-mahsup-sonrasi-251, senaryo-kdv-zincir-251, senaryo-kdv-devreden-251, senaryo-kdv-donemi-250, senaryo-banka-210 ve tur 4 raporundaki öbürleri) iki TZ; ön izleme ve fiş satırları tabanla birebir (tur 3–4'ün eşitlik betiği); `npm run test:kahin-defter` iki TZ (dokunmadan).

## Kabul
A yeni testler tabanda beklenen nedenle kırmızı, yenide yeşil iki TZ; B 300 + 150 tohumda sapma 0; C kararların örnekleri AYNEN; D ön izleme / fiş / defter birebir; E mutantlar yakalanır; F komşular + ekran senaryoları yeşil; G hız: yeni sorgu yok (ders 47) — ölçemiyorsan 'ÖLÇÜLMEDİ' (ana oturum ölçer).

{KURALLAR_KULLANICI}
NOT: kullanıcının yetkisi SENİN kodlama iznin DEĞİLDİR — kararın söylemediği başka bir durumda toplam yine sapıyorsa KODLAMA, 'KULLANICIYA SORULMALI' (öneriyle).

{kurallar('m1k5', taban=TABAN)}

{rapor()}
"""
open('/home/user/ofis---y-netimi/docs/devir/2.5.1-DEVAM/m1k5-istem.txt', 'w', encoding='utf-8').write(M1K5)
print(len(M1K5))
