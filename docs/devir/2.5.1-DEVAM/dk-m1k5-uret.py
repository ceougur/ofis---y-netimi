#!/usr/bin/env python3
# KDV Özeti küçük tur 5 dar kontrol görev metni (YALNIZ tur 5 farkı): dk-m1k5-istem.txt. Kararlar iş listesinden AYNEN çekilir. Ana oturum, 28.11.2026.
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

YASAK = "düzeltme ajanlarının görev metinleri ve raporları (`docs/devir/2.5.1-DEVAM/*-istem.txt`, `*-rapor.md` — özellikle `m1-*`, `m1t2-*`, `m1k*`), önceki dar kontrolün ve ana oturumun not defterleri (`dk-m1k/`, `m1k5rk/`, `m1k5yk/`, `olc28/`); kâhin klasörleri `test/bagimsiz/**` (yalnız `npm run test:kahin-*` komutuyla KOŞABİLİRSİN, kodunu okuma); `docs/kanit/2026-11-28/m1k5-*` (düzeltme ajanının kanıtı)"

DK = dar("dk-m1k5", "KDV ÖZETİ KÜÇÜK TUR 5", "t251-m1k4..t251-m1k5",
 "KDV Özeti raporunun zincirinde 'güncel değil' (mahsup fişinden sonra İndirilecek KDV'si artmış) ayın, sonraki ayların İndirilecek KDV azalmasını düşen birikime hangi İndirilecek KDV ile girdiği (S-DKM1K-1); iki yeni birim test (biri tohumlu rastgele) ve ekran senaryosu senaryo-kdv-mahsup-sonrasi-251'in yeni adımı.",
 "\n".join([
  "- " + satir('S-DKM1K-1 (KDV Özeti tek dar kontrolü ORTA-1'),
  "- " + k('KULLANICI KARARI 27.11 14:18 UTC'),
  "- " + satir('S-M1K3-1 (KDV Özeti küçük tur 3 raporu'),
 ]),
 "\n".join([
  "- ÖNCEKİ DAR KONTROLÜN SONUCU (bu farkın kaynağı): " + parca('BAŞ MİMAR KARARI 28.11 03:55 UTC (DAR KONTROL KDV ÖZETİ KÜÇÜK TUR 1–4', 'ORTA-1', ' DOĞRULANAN:'),
  "- ANA OTURUMUN YENİDEN ÜRETİMİ: " + parca('BAŞ MİMAR KARARI 28.11 04:16 UTC (HIZ KABUL ÖLÇÜMÜ', '(3) KDV ORTA-1', None),
  "- BU TURUN BAŞ MİMAR YORUMU (değerlendir): " + parca('(KDV ÖZETİ KÜÇÜK TUR 5 raporu', '(2) BM-M1K5-1', ' (3) BM-M1K5-2'),
 ]),
 f"kararın örneği programda AYNEN mi (Ocak–Nisan 1.600 = 391 − 191; Nisan 700; Nisan ön izlemesi 500; Şubat notu durur); aralık toplamı = 391 − 191 her birleşimde (artış / azalma × İndirilecek / Hesaplanan × ödenecek / devreden yön × tek / ardışık iki 'güncel değil' ay × azalan ay önce / sonra × araya fişsiz ya da zincirle uyuşmayan ay); bu değişiklikten sonra artık iki kez SAYILAN bir değişiklik var mı (artışın hem ay sonucunda hem birikimde görünmesi ya da azalmanın iki ayda düşülmesi); yalnız Hesaplanan KDV'si değişmiş 'güncel değil' ay (sayılar değişmemeli); fiş Ters Kaydet ile geri alınıp yeniden kesilmiş ay; bu ön izlemeyle kesilen sonraki fişin notu ve önerdiği onarımın gerçekten sonuç verip vermediği (ekranda); yıl dönümü (sonraki yıl Ocak'ı, iki saat dilimi); yıllık özet = ayların toplamı = ekran = PDF = Excel (ders 11, her dönem seçeneği, tek ay seçimi dahil); mahsup ön izlemesi / fişi / defter GERÇEKTEN değişmedi mi; iki şirket; hız (100 bin satırda yıllık özet — aynı veri kopyasıyla önce / sonra, `flock -x -w 1800 {SP}/olcum.lock` özel kilit, alamazsan 'ÖLÇÜLEMEDİ'); yeni testlerin dişi (eski kodda beklenen nedenle kırmızı mı) ve tohumlu rastgele testin üretecinin kararın sınıflarını gerçekten üretip üretmediği; rastgele testin süresi (CI'de iş başına eklediği süre — bilgi).",
 YASAK)
_eski = "(kendi ağacında `git log --oneline -1` ile `t251-m1k5` ucunun geçmişte olduğunu doğrula)"
assert DK.count(_eski) == 1
DK = DK.replace(_eski, "(KDV küçük tur 5 henüz ana dala GİRMEDİ: kendi ağacında, kendi commit'in YOKKEN `git reset --hard t251-m1k5`; `git log --oneline -1` ile 71307f78'i doğrula)")
open('/home/user/ofis---y-netimi/docs/devir/2.5.1-DEVAM/dk-m1k5-istem.txt', 'w', encoding='utf-8').write(DK)
print(len(DK))
