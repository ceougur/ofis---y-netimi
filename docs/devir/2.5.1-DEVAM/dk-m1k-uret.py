#!/usr/bin/env python3
# KDV Özeti küçük tur 1–4 TEK dar kontrol görev metni: dk-m1k-istem.txt. Kararlar iş listesinden AYNEN çekilir. Ana oturum, 28.11.2026.
src = open('/home/user/ofis---y-netimi/docs/devir/2.5.1-DEVAM/istem-uret.py').read().split('# ---------------------------------------------------------------- P-D')[0]
exec(src)
_t = open('/home/user/ofis---y-netimi/docs/devir/2.5.1-DEVAM/istem-uret.py').read()
_i = _t.find('def dar('); _j = _t.find('\nDK_D4ON', _i)
exec(_t[_i:_j])
# M1 dar kontrolünün karar ve baş mimar blokları (27.11; AYNEN — istem-uret.py DK_M1)
_a = _t.find('DK_M1 = dar("dk-m1"'); _b = _t.find('"""', _a); _c = _t.find('"""', _b + 3); _d = _t.find('"""', _c + 3); _e = _t.find('"""', _d + 3)
M1_KARAR = _t[_b + 3:_c].strip(); M1_BM = _t[_d + 3:_e].strip()
assert 'S261' in M1_KARAR and '(6) GÖRÜNÜM' in M1_BM
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

YASAK = "düzeltme ajanlarının görev metinleri ve raporları (`docs/devir/2.5.1-DEVAM/*-istem.txt`, `*-rapor.md` — özellikle `m1-*`, `m1t2-*`, `m1k*`), ana oturumun yeniden koşu not defterleri; kâhin klasörleri `test/bagimsiz/**` (yalnız `npm run test:kahin-*` komutuyla KOŞABİLİRSİN, kodunu okuma)"

DK = dar("dk-m1k", "KDV ÖZETİ KÜÇÜK TUR 1–4", "t251-m1k-taban..t251-m1k4",
 "KDV Özeti (Beyanname Hazırlığı) raporunun mahsup fişi kesilmiş aylarla ilişkisi: kesilmiş fişin aya ait sonucu ve sonraki aya devredenin fişten mi bugünkü kayıtlardan mı geldiği (S-DKM1-1, S-M1K-1, S-M1K2-1, S-M1K3-1), zincirdeki fişin sayılma şartı, 'mahsup fişi güncel değil' notu (S-M1-3) ve kopuk zincirde yön notu (S-M1-2), hareketsiz sonraki ay, tablo altı satırları ve not yazı biçimi, Rapor Merkezi / PDF / Excel karşılıkları; beklentisi değişen testler ve yeni ekran senaryosu senaryo-kdv-mahsup-sonrasi-251.",
 "\n".join([
  M1_KARAR,
  "- " + k('KULLANICI KARARI 27.11 14:18 UTC'),
  "- " + k('KULLANICI KARARI 27.11 16:16 UTC'),
  "- " + k('KULLANICI KARARI 27.11 19:44 UTC'),
  "- " + satir('S-M1K3-1 (KDV Özeti küçük tur 3 raporu'),
 ]),
 "\n".join([
  "- M1 DAR KONTROLÜNE VERİLEN BAŞ MİMAR YORUMLARI (27.11; AYNEN — (5) ve (6) bu farkta düzeltilmiş olmalı):\n" + M1_BM,
  "- M1 DAR KONTROLÜNÜN SONUCU (bu farkın kaynağı): " + parca('BAŞ MİMAR KARARI 27.11 13:41 UTC (KDV Özeti DAR KONTROLÜ', 'ORTA-1', None),
  "- " + parca('BAŞ MİMAR KARARI 27.11 16:08 UTC (KDV ÖZETİ KÜÇÜK TURU', 'KARARLAR:', None),
  "- " + parca('BAŞ MİMAR KARARI 27.11 19:40 UTC (KDV ÖZETİ KÜÇÜK TUR 2', 'KARARLAR:', ' SIRA:'),
  "- " + parca('BAŞ MİMAR KARARI 27.11 20:59 UTC (KDV ÖZETİ KÜÇÜK TUR 3', 'KARARLAR:', None),
  "- " + parca('BAŞ MİMAR KARARI 27.11 21:47 UTC (KDV ÖZETİ KÜÇÜK TUR 4', 'KARARLAR:', None),
  "- " + parca('(KDV ÖZETİ KÜÇÜK TUR 1–4 — EKRAN YÜRÜYÜŞÜ (ana oturum, 28.11', 'SAYILAR KARARLARA UYGUN', ' SIRADA:'),
 ]),
 f"kararların örnek sayıları programda AYNEN mi (S-DKM1-1: Ocak 500 / Şubat 700 / Mart 400 örneği; S-M1K-1 karma ay; S-M1K2-1 devreden yönde yalnız satış KDV'si değişen ay; S-M1K3-1); fişten gelen ay ile bugünkü kayıtlardan gelen ayın her birleşimi (azalma / artış × İndirilecek / Hesaplanan × ödenecek / devreden yön × tek ay / ardışık iki değişmiş ay); fiş Ters Kaydet ile geri alınmış ay, fiş yeniden kesilmiş ay; zincirin başı (yıl başı, ilk kayıttan önce, dönem kilidi, Devir Kapanışı yapılmış ay); sonraki yıl Ocak'ı (yıl dönümü, iki saat dilimi); iadeli aylar (391 / 191); yıllık özet = ayların toplamı = ekran = PDF = Excel (alt TOPLAM satırı — ders 11, her dönem seçeneği); notların (S-M1-2 yön, S-M1-3 güncel değil, 'Mahsup Edilmemiş Ay', 'Zincirle Uyuşmayan Mahsup Fişi') her koşulda doğru ayda ve yazım düzeninde çıkması, birbirini gizlememesi; mahsup ön izlemesi / fişi / defter GERÇEKTEN değişmedi mi (yalnız rapor); Muhasebe rolüyle açılış (yetki); iki şirket; hız (100 bin satırda yıllık özet — aynı veri kopyasıyla önce / sonra, `flock -x -w 1800 {SP}/olcum.lock` özel kilit, alamazsan 'ÖLÇÜLEMEDİ'); beklentisi değiştirilen eski testlerin her değişikliği karara dayanıyor mu (ders 28, 40); yeni ekran senaryosunun dişi (eski kodda beklenen nedenle kırmızı mı).",
 YASAK)
_eski = "(kendi ağacında `git log --oneline -1` ile `t251-m1k4` ucunun geçmişte olduğunu doğrula)"
assert DK.count(_eski) == 1
DK = DK.replace(_eski, "(KDV küçük tur 1–4 henüz ana dala GİRMEDİ: kendi ağacında, kendi commit'in YOKKEN `git reset --hard t251-m1k4`; `git log --oneline -1` ile 4850ae2a'yı doğrula)")
open('/home/user/ofis---y-netimi/docs/devir/2.5.1-DEVAM/dk-m1k-istem.txt', 'w', encoding='utf-8').write(DK)
print(len(DK))
