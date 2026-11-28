#!/usr/bin/env python3
# 2.5.1 ADAY DÜZELTMESİ: KDV Özeti küçük tur 8 (mali müşavir S ORTA-1) + aday UI düzeltme turu (UI/UX ORTA-1/2/3 + mali müşavir D1). Görev metinleri: m1k8-istem.txt, ui251-istem.txt. Kararlar iş listesinden AYNEN. Ana oturum, 28.11.2026.
src = open('/home/user/ofis---y-netimi/docs/devir/2.5.1-DEVAM/istem-uret.py').read().split('# ---------------------------------------------------------------- P-D')[0]
exec(src)
IS = open('/home/user/ofis---y-netimi/docs/2.5.1-IS-LISTESI.md', encoding='utf-8').read()

def satir(anahtar, metin=IS):
    i = metin.find(anahtar); assert i >= 0, anahtar
    assert metin.find(anahtar, i + 1) < 0, 'tekil değil: ' + anahtar
    b = metin.rfind('\n', 0, i) + 1; e = metin.find('\n', i)
    return metin[b:e].strip()

def k(a): return satir(a).split(' UYGULAMA (baş mimar')[0]
MS = satir('(MALİ MÜŞAVİR S raporu — ajan abd18053aa7e82cfc')
UX = satir('(UI/UX TEK TUR raporu — ajan a7cce3dbee12568d5')
DK67 = satir('(DAR KONTROL KDV ÖZETİ KÜÇÜK TUR 6 + 7 raporu')
TABAN = 't251-aday-taban'

M1K8 = f"""Sen DestekOfis projesinde 2.5.1'in KDV ÖZETİ KÜÇÜK TUR 8 KOD ajanısın (eforun high). KDV Özeti küçük tur 1–7 çalışma dalında ve dar kontrolleri kapandı; son adayın mali müşavir S incelemesi bir ORTA bulgu verdi, ana oturum iki TZ YENİDEN ÜRETTİ. Temiz bağlamla YALNIZ bunu düzeltirsin (ders 46). Mahsup fişi, ön izleme ve defter DEĞİŞMEZ — yalnız KDV Özeti RAPORU (sunucu tarafı zinciri, satırları ve notları). İstemci görünümüne (kart yerleşimi) DOKUNMA — paralel UI turu orada çalışıyor.

{hazirlik(taban=TABAN, taban_ne="çalışma dalı ucu — KDV Özeti küçük tur 1–7, Değersiz tur 1–6 dahil")}
3. Sonra oku: `server/routes/tax.mjs` (KDV Özeti zinciri — `vatView`, `runChain`, aralık / ay listesi, uyuşmazlık kaydı), `server/routes/report-center.mjs` (KDV Özeti satırları ve notları), KDV Özeti testleri (`test/kdv-ozeti-*-251.test.mjs`), ekran senaryosu `test/e2e/senaryo-kdv-mahsup-sonrasi-251.mjs`. Ana oturumun yeniden üretimi (izinli — girdin): `{SP}/ms251rk/orta1.mjs` (`ROOT=<kod> node orta1.mjs`; yardımcı `{SP}/dk-m1k5/ortak.mjs`) ve çıktısı `orta1.txt`; dar kontrolün betikleri `{SP}/dk-m1k67/` ve `{SP}/dk-m1k5/`.

## Bulgu ve kararlar (AYNEN)
MALİ MÜŞAVİR S RAPORU VE BAŞ MİMAR KARARI (senin işin YALNIZ 'ORTA-1' ve aynı sınıf): {MS}
DAR KONTROL TUR 6 + 7 (DOĞRULANMADI maddesi aynı sınıf): {DK67}
KARARLAR (değişmez): {satir('S-DKM1K-1 (KDV Özeti tek dar kontrolü ORTA-1')}
{k('KULLANICI KARARI 27.11 14:18 UTC')}
{satir('S-M1K3-1 (KDV Özeti küçük tur 3 raporu')}

## İşler
0. NASIL BOZULUR (koddan ÖNCE, commit): mahsuptan sonra İndirilecek azalışı / Hesaplanan artışı × azalmanın düşüleceği sonraki ay kayıtlı / KAYITSIZ / aralığın dışında × sonraki aylar mahsuplu / mahsupsuz × dönem seçenekleri (Bu Ay, Geçen Ay, Son 30 Gün, Bu Yıl, Tüm Zamanlar, elle aralık; aralık sonu bugünden sonra) × yıl dönümü × iki TZ; fişsiz hareketsiz ay (dar kontrolün tohum 86 sınıfı).
1. Kod: KDV Özeti zinciri aralığın sonuna kadar (bugünü aşmadan) KAYITSIZ ayları da içerir; azalmanın (ya da öbür taşınan etkinin) düşüldüğü ayda ayrı satır ('Önceki Dönem İndirilecek KDV Azalışı (Şubat 2026)' gibi — yazım düzeni) ve o ayın özetinde kısa not; böylece her aralıkta Ödenecek − Sonraki + Önceki = Hesaplanan − İndirilecek ve kayıtsız ayın raporu = o ayın ön izlemesi. Kararın söylemediği bir sayı ayrışması çıkarsa KODLAMA — 'KULLANICIYA SORULMALI'.
2. KALICI TESTLER: ana oturumun orta1 vakası AYNEN (Bu Yıl 2.000; Temmuz kayıtsız rapor = ön izleme 0 / 500 / 0; Temmuz satış 100 → 600 ve açıklayan satır / not); dar kontrolün hareketsiz ay vakası; rastgele testin değişmezine 'kayıtsız ay raporu = ön izleme' eklenir; tabanda beklenen nedenle kırmızı (NEDEN — ders 38), yenide yeşil iki TZ.
3. Mutant: tur 6 + 7'nin mutantları AYNEN + bu turun en az ikisi (kayıtsız ay zincire girmesin; azalış satırı yazılmasın) — kırmızı iki TZ.
4. Komşular: KDV testleri + `git grep` (değişen işlevlerin çağıranları); KDV Özeti'ne dokunan ekran senaryolarının hepsi (senaryo-kdv-mahsup-sonrasi-251, senaryo-kdv-zincir-251, senaryo-kdv-devreden-251, senaryo-kdv-donemi-250, senaryo-c7b-kabul-250, senaryo-defter-243) iki TZ; ön izleme / fiş / defter tabanla BİREBİR; `npm run test:kahin-defter` iki TZ; hız (yeni ay listesi 100 bin satırda kötüleşmez — ölçemiyorsan 'ÖLÇÜLMEDİ').

## Kabul
A yeni testler tabanda beklenen nedenle kırmızı, yenide yeşil iki TZ; B aralık özdeşliği ve 'kayıtsız ay = ön izleme' rastgelede bozulmaz; C ön izleme / fiş / defter birebir; D mutantlar yakalanır; E komşular + ekran senaryoları yeşil; F hız kötüleşmez.

{KURALLAR_KULLANICI}
NOT: kullanıcının yetkisi SENİN kodlama iznin DEĞİLDİR — yeni bir SAYI ayrışmasında KODLAMA, 'KULLANICIYA SORULMALI' (öneriyle).

{kurallar('m1k8', taban=TABAN)}

{rapor()}
"""
open('/home/user/ofis---y-netimi/docs/devir/2.5.1-DEVAM/m1k8-istem.txt', 'w', encoding='utf-8').write(M1K8)

UI = f"""Sen DestekOfis projesinde 2.5.1 SON ADAYININ UI DÜZELTME ajanısın (eforun high). Son adayın UI/UX incelemesi üç ORTA görünüm bulgusu, mali müşavir incelemesi bir yanlış hesap adı (D1) verdi; ana oturum ekran görüntüleriyle doğruladı. Temiz bağlamla YALNIZ bunları düzeltirsin (ders 46). Para, defter, KDV hesabı, sunucu kuralları DEĞİŞMEZ; KDV Özeti'nin SUNUCU tarafına (`server/routes/tax.mjs`, `server/routes/report-center.mjs` zincir / notlar) DOKUNMA — paralel KDV tur 8 orada çalışıyor (kart ADLARI ya da satırları değişebilir; senin işin yalnız yerleşim).

{hazirlik(taban=TABAN, taban_ne="çalışma dalı ucu")}
3. Sonra oku: istemcinin bildirim (toast) bileşeni ve biçemi (`client/assets/` — `git grep` ile bul), KDV Özeti tutar kartlarının yerleşimi ve alçak ekran kuralı (max-height medya sorgusu), KDV Mahsup Fişi penceresinin 'Mahsup Edilen Aylar' tablosu (Durum rozeti, Geri Al), Değersiz Alacak Yaz formundaki '659' metni. UI/UX ajanının betikleri ve ekran görüntüleri (izinli — girdin): `{SP}/uiux251/` (deg/06-ret-odeme-sil.png, deg/11-ust-uste-bildirim.png, kdv3/01-olc-1366x768.png, kdv3/02-olc-1280x720.png, kdv4/02-mahsup-1440x900.png, kdv/10-mahsup-pencere.png; betikler degersiz*.mjs, kdv-olc*.mjs).

## Bulgular ve kararlar (AYNEN)
UI/UX RAPORU VE BAŞ MİMAR KARARI: {UX}
MALİ MÜŞAVİR D1 (karar: bu turda, yalnız metin): {MS}

## İşler
1. UI-1: uzun hata bildirimi (ör. 300 karakterden uzun ya da 'Ne yapmalı:' içeren) geniş biçimde gösterilir (ör. `width: min(720px, calc(100vw - 36px))`, ~9 satır) ve iletinin söylediği düğmeyi ÖRTMEZ (konum: pencerenin üst ortası yerine ekranın bir köşesi ya da pencerenin dışı — hangisi düğmeyi örtmüyorsa; ölç); bu tür bildirim yalnız × ile kapanır (süre sınırı yok); üst üste binen bildirimler ekrandan taşmaz (en çok N görünür ya da kaydırılabilir yığın). Kısa bildirimler BUGÜNKÜ gibi.
2. UI-2: KDV Özeti tutar kartları alçak ekranda (1366×768, 1280×720) kesilmez / gizlenmez — kart satırı sarılır (`flex-wrap: wrap`) ya da sığacak biçimde küçülür; 1440×900 ve 1920×1080 görünümü bozulmaz; telefonda yatay sayfa kayması yok.
3. UI-3: KDV Mahsup Fişi penceresinde 'Mahsup Edilen Aylar' tablosunda Durum rozeti satıra kırılır (ya da Geri Al Durum hücresine alınır) — Geri Al 1366×768, 1440×900, 1920×1080'de yatay kaydırmasız GÖRÜNÜR.
4. D1: Değersiz Alacak Yaz formunda '659 Diğer Olağandışı Gider' → '659 Diğer Olağan Gider ve Zararlar' (hesap planındaki adla aynı; `git grep` ile bütün geçtiği yerler — yazım düzeni testi).
5. KANIT: her iş için ekran görüntüsü (önce / sonra; ölçülen konumlar — düğme ile bildirimin çakışmadığı sayıyla), bir ekran senaryosu adımı ya da yeni küçük e2e (`test/e2e/` — CI listesine eklenmesi gerekiyorsa raporda 'CI listesine eklenecek'); yazım düzeni testi; değişen istemci dosyalarına dokunan e2e'ler (senaryo-degersiz-iptal-m2t2-251, senaryo-kdv-mahsup-sonrasi-251, senaryo-kdv-zincir-251, senaryo-kdv-donemi-250, ui / uiux senaryoları — `git grep` ile bul) iki TZ.

## Kabul
A dört iş ekranda ölçülerek doğrulandı (önce / sonra görüntü); B kısa bildirimler ve öbür ekranlar değişmedi; C ilgili e2e'ler ve yazım düzeni testi yeşil; D tabanda yeni e2e adımı beklenen nedenle kırmızı (NEDEN), yenide yeşil.

{KURALLAR_KULLANICI}

{kurallar('ui251', taban=TABAN)}

{rapor()}
"""
open('/home/user/ofis---y-netimi/docs/devir/2.5.1-DEVAM/ui251-istem.txt', 'w', encoding='utf-8').write(UI)
print(len(M1K8), len(UI))
