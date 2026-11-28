#!/usr/bin/env python3
# Müşteri istekleri tur 3 dar kontrol görev metni: dk-mi3-istem.txt. Kararlar iş listesinden AYNEN. Ana oturum, 28.11.2026.
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

YASAK = "düzeltme ajanlarının görev metinleri ve raporları (`docs/devir/2.5.1-DEVAM/*-istem.txt`, `*-rapor.md` — özellikle `mi-*`, `mi2-*`, `mi3-*`), ana oturumun yeniden koşu not defterleri; kâhin klasörleri `test/bagimsiz/**` (yalnız `npm run test:kahin-*` komutuyla KOŞABİLİRSİN, kodunu okuma)"

DK = dar("dk-mi3", "Mİ TUR 3 (müşteri istekleri — dönem seçici ve toplu WhatsApp)", "t251-mi3-taban..t251-mi3",
 "cari listesi istemcisinde 'uygulanan dönem' düzeni: 'Bu Dönemde Ödeme Yapanlar' açıkken dönem 'Tarih Aralığı'na çevrilip günler seçilmemişken liste / PDF / Excel / Grup Özeti / arka plan yenilemesi son uygulanan dönemle, bekleyen seçim yazısı, 'Tümüne WhatsApp' gizli, başlık kutusu yalnız ekrandaki carileri seçer, ters aralık açıklaması; Grup Özeti testine 'Diğer' (Kredi Kartına İade) değeri; ekran senaryosuna kalıcı adım.",
 "- 2.5.1 plan taslağı `docs/devir/2.5.1-PLAN-TASLAK.md` §3 (Mİ-2 — OKU, yalnız §3).\n- " + satir('KULLANICI KARARI 27.11 08:06 UTC').split(' UYGULAMA (baş mimar')[0],
 "\n".join([
  "- TUR 1'İN BAŞ MİMAR KARARLARI (AYNEN; (5) özellikle): " + parca('BAŞ MİMAR KARARI 27.11 07:58 UTC (Mİ RAPORU', 'KARARLAR:', ' SIRA:'),
  "- DAR KONTROL Mİ'NİN BULGUSU VE BAŞ MİMAR KARARI (bu farkın kaynağı): " + satir('(DAR KONTROL Mİ raporu'),
  "- TUR 3 İÇİN BAŞ MİMAR KARARLARI: " + parca('(MÜŞTERİ İSTEKLERİ TUR 3 raporu', 'KARARLAR:', ' SIRA:'),
 ]),
 "kararın (5) 'süzgeçte görünmeyene ileti gitmesin' ilkesinin HER yolda tutması (Tümüne WhatsApp / Mesaj, başlık kutusu, 'Daha Fazla Göster' ile 300'ü aşan liste, sayfa yenileme, sekme değiştirip dönme, pencereyi kapatıp açma, arka plan yenilemesi, cari ekleme / silme sonrası yenileme); dönem seçicinin HER seçeneği × 'Ödeme Yapanlar' açık / kapalı × aralık boş / yalnız biri / ters / geçerli — ekran = PDF = Excel = Grup Özeti (alt TOPLAM satırı — ders 11); hiç dönem uygulanmamışken (Yok → Tarih Aralığı → kutu) davranış; klavye (Tab, ok tuşları, Space — ders 12; ok tuşuyla ara dönemlerin uygulanması); bekleyen yazının yazım düzeni ve doğru dönemi söylemesi; 'Diğer' sınıfının (POS Komisyon İadesi dahil) Liste / Grup Özeti / rapor eşdeğerliği; sayılar değişmedi mi (Grup Özeti 600 / 900 / 0, TOPLAM 1.500); yeni sorgu / istek eklenmiş mi (hız — ders 47); mobil ekran; yetkisiz kullanıcı; iki şirket; iki saat dilimi (gün sınırında 'Bugün').",
 YASAK)
_eski = "(kendi ağacında `git log --oneline -1` ile `t251-mi3` ucunun geçmişte olduğunu doğrula)"
assert DK.count(_eski) == 1
DK = DK.replace(_eski, "(Mİ tur 3 henüz ana dala GİRMEDİ: kendi ağacında, kendi commit'in YOKKEN `git reset --hard t251-mi3`; `git log --oneline -1` ile 9cc60ff8'i doğrula)")
open('/home/user/ofis---y-netimi/docs/devir/2.5.1-DEVAM/dk-mi3-istem.txt', 'w', encoding='utf-8').write(DK)
print(len(DK))
