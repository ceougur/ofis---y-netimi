#!/usr/bin/env python3
# KDV Özeti küçük tur 4 görev metni: m1k4-istem.txt. Kullanıcı kararları iş listesinden AYNEN çekilir. Ana oturum, 27.11.2026.
src = open('/home/user/ofis---y-netimi/docs/devir/2.5.1-DEVAM/istem-uret.py').read().split('# ---------------------------------------------------------------- P-D')[0]
exec(src)
IS = open('/home/user/ofis---y-netimi/docs/2.5.1-IS-LISTESI.md', encoding='utf-8').read()

def satir(anahtar, metin=IS):
    i = metin.find(anahtar); assert i >= 0, anahtar
    assert metin.find(anahtar, i + 1) < 0, 'tekil değil: ' + anahtar
    b = metin.rfind('\n', 0, i) + 1; e = metin.find('\n', i)
    return metin[b:e].strip()

Q = satir('S-M1K3-1 (KDV Özeti küçük tur 3 raporu §7')
YETKI = satir('KULLANICI KARARI 27.11 20:26 UTC (AYNEN: "bir süre ekran başında olmayacağım')
K_M1K2 = satir('KULLANICI KARARI 27.11 19:44 UTC').split(' UYGULAMA (baş mimar')[0]
K_M1K = satir('KULLANICI KARARI 27.11 16:16 UTC').split(' UYGULAMA (baş mimar')[0]
K_DKM = satir('KULLANICI KARARI 27.11 14:18 UTC').split(' UYGULAMA (baş mimar')[0]
BM3 = satir('BAŞ MİMAR KARARI 27.11 20:59 UTC (KDV ÖZETİ KÜÇÜK TUR 3 raporu')

M1K4 = f"""Sen DestekOfis projesinde 2.5.1'in KDV ÖZETİ KÜÇÜK TUR 4 KOD ajanısın (eforun high). KDV Özeti küçük tur 1–3 başka ajanlarla bitti (tur 3'ün dal ucu etiketi t251-m1k3 = 36b77d4b; ana dala GİRMEDİ); sen temiz bağlamla YALNIZ aşağıdaki TEK maddeyi yaparsın (ders 46). Mahsup fişi, ön izleme ve defter DEĞİŞMEZ — yalnız KDV Özeti raporunun gösterimi.

{hazirlik(taban="t251-m1k3", taban_ne="KDV Özeti küçük tur 3'ün dal ucu 36b77d4b")}
3. Sonra oku: tur 3'ün raporu `docs/devir/2.5.1-DEVAM/m1k3-rapor.md` (kendi ağacında; §5 tablo, §7 S-M1K3-1, §8, §16 betikleri), farkı `git diff t251-m1k2 t251-m1k3 -- server test`, `test/kdv-ozeti-yalniz391-251.test.mjs`, `server/routes/tax.mjs` (KDV Özeti zincir döngüsü).

## Kararlar (AYNEN)
SORU (tur 3 raporundan, iş listesi C'de AYNEN): {Q}
KULLANICI YETKİSİ (AYNEN): {YETKI}
ÖNCEKİ KARARLAR (değişmez): {K_M1K2}
{K_M1K}
{K_DKM}
TUR 3 BAŞ MİMAR KARARLARI (AYNEN): {BM3}

## İşler
0. NASIL BOZULUR (rapor taslağının başına, koddan ÖNCE, commit): (a) ödenecek fişli ay yalnız satış azalmasıyla devredene döner; (b) devreden fişli ayda İndirilecek artar; (c) ikisi birden; ödenecek fişli ay ödenecek kalır (DEĞİŞMEZ olmalı); fişli ay 'güncel' (değişmemiş) — DEĞİŞMEZ; araya mahsupsuz ay; yıl dönümü; iki ardışık 'güncel değil' ay; geri al + yeniden mahsup (onarım) sonrası rapor = fişler.
1. Kod: S-M1K3-1 = A — her 'güncel değil' ayında sonraki aya BU AYIN bugünkü devredeni taşınır (tur 3 raporunun Y3 / Y4 mutantlarının davranışı; kararın dışındaki hiçbir koşul gevşemez). Sorunun iki örneği AYNEN kalıcı testte: (a) Nisan Önceki 300 / Ödenecek 0 / Sonraki 100, Mart–Nisan Ödenecek 0, Sonraki 100 (= 391 − 191) + Nisan satırında 'Zincirle Uyuşmayan Mahsup Fişi' notu (programın mevcut kalıbıyla; metni ekranda OKU ve rapora AYNEN yaz); (b) Nisan Önceki 900 / Ödenecek 100, Mart–Nisan 100 + not. Tur 3'ün tablosunda bu iki durumu 'bugünkü davranışla' sabitleyen satırlar A'ya döner (eski sayı → yeni sayı rapora). Her durumda aralık toplamı = 391 − 191 (genel değişmez testi: tur 1–4'ün bütün örneklerinde).
2. Ön izleme ve fiş satırları tabanla birebir (tur 3'ün eşitlik betiği AYNEN, yollar bu tura) iki TZ.
3. Ekran senaryosu: `test/e2e/senaryo-kdv-mahsup-sonrasi-251.mjs`'e (a) örneği eklenir (ekranda Nisan özet kartları + not); senaryonun bütün adımları iki kurulumda yeşil.
4. Mutant: tur 1–3'ün 39'u AYNEN (Y3 / Y4 artık doğru davranış olduğu için YERİNE: 'güncel değil ödenecek fişli ayda fişin devredeni taşınsın', 'devreden fişli ayda İndirilecek artışı taşınmasın', 'güncel ayda da bugünkü devreden taşınsın') — her biri en az bir testte kırmızı iki TZ.
5. Kâhin: `npm run test:kahin-defter` iki TZ 187 / 187 (dokunmadan). Komşular: tur 3'ün 50 dosyası + yeni (git grep).

## Kabul
A yeni / değişen testler tabanda (t251-m1k3) beklenen nedenle kırmızı (NEDENİ yazılır — ders 38), yenide yeşil iki TZ; B ön izleme / fiş birebir; C komşular iki TZ yeşil; D KDV Özeti'ne dokunan ekran senaryolarının HEPSİ (tur 3'ün 8'i) yeşil — beklentisi değişen her senaryo koşulur (ders 28); E mutantlar hepsi yakalanır iki TZ; F hız: yeni sorgu eklenmez (ders 47); ölçemiyorsan 'ÖLÇÜLMEDİ'.

{KURALLAR_KULLANICI}
NOT: kullanıcının yetkisi SENİN kodlama iznin DEĞİLDİR — kararın söylemediği başka bir durumda toplam yine sapıyorsa KODLAMA, 'KULLANICIYA SORULMALI' (öneriyle).

{kurallar('m1k4', taban="t251-m1k3")}

{rapor()}
"""
open('/home/user/ofis---y-netimi/docs/devir/2.5.1-DEVAM/m1k4-istem.txt', 'w', encoding='utf-8').write(M1K4)
print(len(M1K4))
