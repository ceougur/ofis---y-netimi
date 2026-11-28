#!/usr/bin/env python3
# KDV Özeti küçük tur 6 + 7 TEK dar kontrol görev metni (fark t251-m1k6-taban..t251-m1k7): dk-m1k67-istem.txt. Kararlar iş listesinden AYNEN. Ana oturum, 28.11.2026.
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

def k(anahtar):
    return satir(anahtar).split(' UYGULAMA (baş mimar')[0]

YASAK = "düzeltme ajanlarının görev metinleri ve raporları (`docs/devir/2.5.1-DEVAM/*-istem.txt`, `*-rapor.md` — özellikle `m1k*`), `docs/kanit/2026-11-28/m1k6-*` ve `m1k7-*` (düzeltme ajanlarının kanıtı), ana oturumun not defterleri (`m1k6yk/`, `m1k7yk/`, `m1k5yk/`, `olc28/`); kâhin klasörleri `test/bagimsiz/**` (yalnız `npm run test:kahin-*` komutuyla KOŞABİLİRSİN, kodunu okuma). İZİNLİ: önceki dar kontrolün betikleri `" + SP + "/dk-m1k5/` (kendi girdin olarak)."

DK = dar("dk-m1k67", "KDV ÖZETİ KÜÇÜK TUR 6 + 7", "t251-m1k6-taban..t251-m1k7",
 "YALNIZ KDV Özeti raporunun NOTLARI (sayılar, mahsup fişi, ön izleme, defter değişmemeli): 'Zincirle Uyuşmayan Mahsup Fişi' notunun yönü (zincir emilimi fişinkinden eksi / artı) ve onarım cümlesi (mahsup fişi güncel olmayan ilk aydan başlayarak — eksi yön kolu ve devreden farkı kolu), yeni 'Güncel Olmayan Önceki Fiş' notu (tek ay / kısmi aralık — aralık dışındaki güncel olmayan fiş sayıyı GERÇEKTEN etkiliyorsa), KDV Özeti zincirinin bir işleve alınıp ikinci kez (fişler olduğu gibi) hesaplanması; birim testleri, rastgele testin yıl dönümü tohum formülü, ekran senaryosu senaryo-kdv-mahsup-sonrasi-251'in C / D / E / F adımları.",
 "\n".join([
  "- " + satir('S-DKM1K-1 (KDV Özeti tek dar kontrolü ORTA-1'),
  "- " + k('KULLANICI KARARI 27.11 14:18 UTC'),
  "- " + satir('KULLANICI KARARI 27.11 20:26 UTC (AYNEN: "bir süre ekran başında olmayacağım'),
 ]),
 "\n".join([
  "- BU FARKIN KAYNAĞI (tur 5 dar kontrolü): " + satir('(DAR KONTROL KDV ÖZETİ KÜÇÜK TUR 5 raporu'),
  "- TUR 6 İÇİN BAŞ MİMAR KARARLARI (devreden kolu → tur 7): " + parca('(KDV ÖZETİ KÜÇÜK TUR 6 raporu', 'KARARLAR:', ' (2) TOKEN'),
  "- TUR 7 İÇİN BAŞ MİMAR KARARLARI (DEĞERLENDİR — karar metnine ve kullanıcıya doğru yolu söyleme amacına uyuyor mu): " + parca('(KDV ÖZETİ KÜÇÜK TUR 7 raporu', 'BAŞ MİMAR KARARI GEREKİYOR', ' KILAVUZ ÖNERİSİ'),
  "- ANA OTURUM: tur 6 ve 7 yeniden koşusu ajanlarla birebir; hız kabul (100 bin satır, özel kilit) kötüleşen yok, sayılar birebir.",
 ]),
 f"notun söylediği onarım HER durumda gerçekten notu kaldırıyor mu (eksi yön, devreden farkı, karma, yalnız 391, iki 'güncel değil' ay, zincirleme uyuşmazlık, yıl dönümü, onarım ayı aralığın dışında, önceden mahsupsuz ay — kendi üretecinle; ekrandan da yürü); onarım ayının adı doğru ay mı (ilk güncel olmayan; yıl dönümünde yılıyla); 'Güncel Olmayan Önceki Fiş' notu gereksiz yere çıkıyor ya da gereken yerde çıkmıyor mu (her dönem seçeneği — Bu Ay, Geçen Ay, Son 30 Gün, Bu Yıl, Tüm Zamanlar, elle aralık; ders 11); notların ekran = PDF = Excel aynılığı; sayıların tabanla BİREBİR olduğu (rastgele üreteçle taban ↔ yeni, iki TZ) — zincirin işleve alınması ve ikinci hesap hiçbir sayıyı değiştirmemeli; ikinci hesabın hızı (100 bin satırda yıllık özet, tek ay, Tüm Zamanlar — özel kilit `flock -x -w 1800 {SP}/olcum.lock`, alamazsan 'ÖLÇÜLEMEDİ'); yazım düzeni (not başlıkları her sözcük büyük, cümle cümle düzeninde); iki şirket; yeni testlerin dişi (eski kodda beklenen nedenle kırmızı mı).",
 YASAK)
open('/home/user/ofis---y-netimi/docs/devir/2.5.1-DEVAM/dk-m1k67-istem.txt', 'w', encoding='utf-8').write(DK)
print(len(DK))
