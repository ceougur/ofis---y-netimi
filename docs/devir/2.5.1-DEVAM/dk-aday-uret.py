#!/usr/bin/env python3
# 2.5.1 ADAY DÜZELTMESİ TEK DAR KONTROL (KDV tur 8 + aday UI düzeltme turu; fark t251-aday-taban..t251-aday-birlesim): dk-aday-istem.txt. Kararlar iş listesinden AYNEN. Ana oturum, 28.11.2026.
src = open('/home/user/ofis---y-netimi/docs/devir/2.5.1-DEVAM/istem-uret.py').read().split('# ---------------------------------------------------------------- P-D')[0]
exec(src)
_t = open('/home/user/ofis---y-netimi/docs/devir/2.5.1-DEVAM/istem-uret.py').read()
_i = _t.find('def dar('); _j = _t.find('\nDK_D4ON', _i)
exec(_t[_i:_j])
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

YASAK = f"düzeltme ajanlarının görev metinleri ve raporları (`docs/devir/2.5.1-DEVAM/*-istem.txt`, `*-rapor.md` — özellikle `m1k8-*`, `ui251-*`), `docs/kanit/2026-11-28/m1k8/` ve `ui251-*` (düzeltme ajanlarının kanıtı), ana oturumun not defterleri (`m1k8yk/`, `ui251yk/`, `ms251rk/`, `bir28e/`); kâhin klasörleri `test/bagimsiz/**` (yalnız `npm run test:kahin-*` komutuyla KOŞABİLİRSİN, kodunu okuma). İZİNLİ: UI/UX incelemesinin not defteri `{SP}/uiux251/` ve mali müşavirin `{SP}/ms251/` (bulgu kaynakları — kendi girdin olarak), önceki KDV dar kontrollerinin betikleri `{SP}/dk-m1k67/`, `{SP}/dk-m1k5/`."

DK = dar("dk-aday", "2.5.1 ADAY DÜZELTMESİ (KDV TUR 8 + UI DÜZELTME TURU)", "t251-aday-taban..t251-aday-birlesim",
 "(1) SUNUCU — KDV Özeti zinciri: ilk KDV ayından bugünkü aya kadar KAYITSIZ aylar da dolaşılır (S4 birikimi varsa adım), azalışın kaynak ayı izlenir; rapora 'Önceki Dönem İndirilecek KDV Azalışı (… )' ay satırı, aralık öncesi azalış için özet tutar kartı ve 'İndirilecek KDV Azalışı Düşülen Ay' notu; testler (kayıtsız ay testi, rastgele testin iki yeni değişmezi). (2) İSTEMCİ — uzun hata bildirimi (hata ve > 300 harf ya da 'Ne yapmalı:'; 720 px, pencere açıkken altta, süreyle kapanmaz, en çok 2, sonradan açılan pencerede gizlenir), KDV Özeti kart satırının alçak ekranda sarılması, KDV Mahsup Fişi penceresinde başlık / rozet sarması (Geri Al görünür), Değersiz formunda '659 Diğer Olağan Gider ve Zararlar'; yeni ekran senaryosu senaryo-ui251-gorunum; CI / yayın listelerine eklenmesi.",
 "\n".join([
  "- " + satir('S-DKM1K-1 (KDV Özeti tek dar kontrolü ORTA-1'),
  "- " + satir('KULLANICI KARARI 27.11 14:18 UTC').split(' UYGULAMA (baş mimar')[0],
  "- " + satir('S-M1K3-1 (KDV Özeti küçük tur 3 raporu'),
 ]),
 "\n".join([
  "- BU FARKIN KAYNAĞI 1 (mali müşavir S — ORTA-1 senin konun; öbür maddeler karar için): " + satir('(MALİ MÜŞAVİR S raporu — ajan abd18053aa7e82cfc'),
  "- BU FARKIN KAYNAĞI 2 (UI/UX — ORTA-1/2/3): " + parca('(UI/UX TEK TUR raporu — ajan a7cce3dbee12568d5', 'SONUÇ:', ' DÜŞÜK 10'),
  "- KDV TUR 8'İN BAŞ MİMAR KARARLARI (DEĞERLENDİR): " + parca('(KDV ÖZETİ KÜÇÜK TUR 8 raporu', 'BAŞ MİMAR KARARI GEREKİYOR', ' DOĞRULANMADI (ajan)'),
  "- UI TURUNUN BAŞ MİMAR KARARLARI (DEĞERLENDİR): " + parca('(ADAY UI DÜZELTME TURU raporu', 'BAŞ MİMAR KARARI GEREKİYOR', ' CI LİSTESİ'),
  "- ANA OTURUM: iki tur yeniden koşuldu (ajanlarla uyumlu), hız (100 bin satırda yıllık en çok ~%4–10, öbürleri gürültü içinde, sayılar birebir), ekran yürüyüşü (Bu Yıl 2.000, Temmuz yedi kart iki satırda).",
 ]),
 f"KDV: aralık özdeşliği (Ödenecek − Sonraki + Önceki = 391 − 191) ve 'kayıtsız ay = ön izleme' HER dönem seçeneğinde (Bu Ay, Geçen Ay, Son 30 Gün, Bu Yıl, Tüm Zamanlar, elle aralık, aralık sonu bugünden sonra, yıl dönümü) — kendi üretecinle; kayıtsız ayların zincire girmesinin ÖNCEKİ davranışı bozmadığı (aralık içi azalış iki kez görünmüyor; mahsupsuz ay, güncel değil ay, zincirle uyuşmayan fiş notları; ön izleme / fiş / defter tabanla birebir); azalış satırı / kartı / notunun doğruluğu (kaynak ay adı, iki azalış ayı, aynı ayda fişten sonra ikinci azalış), ekran = PDF = Excel; Dönem Kilidi altında kayıtsız ay; iki şirket; hız (100 bin satırda yıllık / Tüm Zamanlar — özel kilit `flock -x -w 1800 {SP}/olcum.lock`, alamazsan 'ÖLÇÜLEMEDİ'). UI: uzun bildirimin tanımının yanlış yere düşmemesi (kısa hata / uyarı / bilgi bildirimleri eskisi gibi mi; 'Ne yapmalı:' içeren her iletinin kaynağı), kalıcı bildirimin hiçbir düğmeyi / soruyu örtmemesi (bütün pencere türleri, telefon, 1280×720), sonradan açılan pencerede gizlenip kapanınca geri gelmesi, klavye ile (Esc / Tab) erişim, yazım düzeni; KDV kart sarmasının başka raporları etkilememesi; mahsup tablosunun bütün ekran boylarında Geri Al'ı göstermesi; CI listesine eklenen senaryonun iş akışlarında doğru yerde olması (ders 49).",
 YASAK)
open('/home/user/ofis---y-netimi/docs/devir/2.5.1-DEVAM/dk-aday-istem.txt', 'w', encoding='utf-8').write(DK)
print(len(DK))
